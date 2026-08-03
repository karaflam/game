import { useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { HandPose } from './handPoses';
import type { ThemeMaterial } from '../themeMaterials';
import { easeOutBack } from '../easing';

type LowPolyHandProps = {
  pose: HandPose;
  position: [number, number, number];
  mirrored: boolean;
  material: ThemeMaterial;
  transitionProgress: number; // 0..1, where the hand's pose transition currently stands
};

// human_hand_base_mesh.glb: see public/models/license.txt (Sketchfab Standard).
// The other two were generated with Meshy AI specifically for this project.
export const OPEN_HAND_URL = '/models/human_hand_base_mesh.glb';
export const FIST_URL = '/models/Meshy_AI_Clenched_Fist_0803190636_generate.glb';
export const PEACE_SIGN_URL = '/models/Meshy_AI_Peace_Sign_0803185859_generate.glb';

type PoseAsset = { url: string; rotation: [number, number, number]; scale: number };

// Each pose is a separate, already-posed mesh (no shared topology, so poses
// crossfade via opacity rather than vertex morphing). human_hand_base_mesh.glb
// has fingers along +Z needing a corrective rotation to stand upright; the
// Meshy-generated meshes are already Y-up.
//
// Scales are normalized so every pose reads as roughly the same hand size —
// the raw meshes are not: the open-hand mesh is ~1.47 units tall vs. ~1.9 for
// the fist/peace-sign meshes, which made the hand visibly grow mid-crossfade.
const POSE_ASSET: Record<HandPose, PoseAsset> = {
  neutral: { url: OPEN_HAND_URL, rotation: [-Math.PI / 2, 0, 0], scale: 0.68 },
  feuille: { url: OPEN_HAND_URL, rotation: [-Math.PI / 2, 0, 0], scale: 0.68 },
  pierre: { url: FIST_URL, rotation: [0, 0, 0], scale: 0.53 },
  ciseau: { url: PEACE_SIGN_URL, rotation: [0, 0, 0], scale: 0.53 }
};

function findFirstMeshGeometry(scene: THREE.Object3D, url: string): THREE.BufferGeometry {
  const meshes: THREE.Mesh[] = [];
  scene.traverse(obj => {
    if ((obj as THREE.Mesh).isMesh) {
      meshes.push(obj as THREE.Mesh);
    }
  });
  const geometry = meshes[0]?.geometry;
  if (!geometry) {
    throw new Error(`LowPolyHand: no mesh found in ${url}`);
  }
  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals();
  }
  return geometry;
}

function useHandGeometry(url: string): THREE.BufferGeometry {
  const { scene } = useGLTF(url);
  return useMemo(() => findFirstMeshGeometry(scene, url), [scene, url]);
}

function PoseMesh({
  pose,
  material,
  opacity,
  renderOrder,
  easedScale = 1
}: {
  pose: HandPose;
  material: ThemeMaterial;
  opacity: number;
  renderOrder: number;
  easedScale?: number;
}) {
  const asset = POSE_ASSET[pose];
  const geometry = useHandGeometry(asset.url);

  return (
    <group rotation={asset.rotation} scale={asset.scale * easedScale}>
      <mesh geometry={geometry} castShadow receiveShadow renderOrder={renderOrder}>
        <meshStandardMaterial
          color={material.baseColor}
          emissive={material.emissive}
          metalness={material.metalness}
          roughness={material.roughness}
          transparent={opacity < 1}
          opacity={opacity}
          depthWrite={opacity >= 0.5}
        />
      </mesh>
    </group>
  );
}

export function LowPolyHand({ pose, position, mirrored, material, transitionProgress }: LowPolyHandProps) {
  const previousPoseRef = useRef<HandPose>(pose);
  const fromPoseRef = useRef<HandPose>(pose);

  if (previousPoseRef.current !== pose) {
    fromPoseRef.current = previousPoseRef.current;
    previousPoseRef.current = pose;
  }

  const t = Math.min(Math.max(transitionProgress, 0), 1);
  const crossfading =
    fromPoseRef.current !== pose && POSE_ASSET[fromPoseRef.current].url !== POSE_ASSET[pose].url && t < 1;

  const direction = mirrored ? -1 : 1;

  return (
    <group position={position} scale={[direction, 1, 1]}>
      {crossfading && (
        <PoseMesh pose={fromPoseRef.current} material={material} opacity={1 - t} renderOrder={0} />
      )}
      <PoseMesh
        pose={pose}
        material={material}
        opacity={crossfading ? t : 1}
        renderOrder={1}
        easedScale={crossfading ? easeOutBack(t) : 1}
      />
    </group>
  );
}
