import * as THREE from "three";
import { loadVehiclePrototype } from "./VehicleModelLibrary.js";

// Level 1 parks a few hundred cars. Each prototype mesh is instanced so the
// full lot stays cheap, while updatePlacement lets an impacted car move without
// replacing the field with hundreds of individual GLTF clones.
export async function createInstancedCarField(placements,{variant="lite"}={}){
  const root=new THREE.Group(),bySpec=new Map(),bindings=new Map();
  root.name="instanced-car-field";
  for(const placement of placements){const group=bySpec.get(placement.spec)??[];group.push(placement);bySpec.set(placement.spec,group);}
  await Promise.all([...bySpec].map(async([spec,group])=>{
    const prototype=await loadVehiclePrototype(spec,variant);prototype.updateMatrixWorld(true);
    const parts=[];prototype.traverse(child=>{if(child.isMesh&&child.geometry)parts.push({geometry:child.geometry,material:child.material,local:child.matrixWorld.clone()});});
    const holder=new THREE.Matrix4(),combined=new THREE.Matrix4(),quaternion=new THREE.Quaternion(),axis=new THREE.Vector3(0,1,0),position=new THREE.Vector3(),scale=new THREE.Vector3(1,1,1);
    for(const part of parts){
      const mesh=new THREE.InstancedMesh(part.geometry,part.material,group.length);mesh.castShadow=false;mesh.receiveShadow=true;mesh.name=`${spec.id}-instances`;
      group.forEach((placement,index)=>{position.set(placement.x,placement.y??0,placement.z);quaternion.setFromAxisAngle(axis,placement.angle);holder.compose(position,quaternion,scale);combined.multiplyMatrices(holder,part.local);mesh.setMatrixAt(index,combined);const list=bindings.get(placement)??[];list.push({mesh,index,local:part.local});bindings.set(placement,list);});
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.frustumCulled=false;root.add(mesh);
    }
  }));
  root.userData.updatePlacement=placement=>{
    const list=bindings.get(placement);if(!list)return;
    const holder=new THREE.Matrix4(),combined=new THREE.Matrix4(),position=new THREE.Vector3(placement.x,placement.y??0,placement.z),quaternion=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),placement.angle),scale=new THREE.Vector3(1,1,1);holder.compose(position,quaternion,scale);
    for(const {mesh,index,local} of list){combined.multiplyMatrices(holder,local);mesh.setMatrixAt(index,combined);mesh.instanceMatrix.needsUpdate=true;}
  };
  return root;
}
