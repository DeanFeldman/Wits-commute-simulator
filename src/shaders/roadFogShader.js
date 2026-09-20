import * as THREE from "three";

export const RoadFogShader={
  name:"RoadFogShader",
  uniforms:{
    tDiffuse:{value:null},
    tDepth:{value:null},
    uProjectionMatrixInverse:{value:new THREE.Matrix4()},
    uCameraMatrixWorld:{value:new THREE.Matrix4()},
    uFogColor:{value:new THREE.Color(0x8ec9ee)},
    uFogCenterX:{value:0},
    uFogCenterZ:{value:0},
    uRadialMode:{value:0},
    uFogStart:{value:24},
    uFogEnd:{value:58},
    uDensity:{value:1.5},
    uRearFogStart:{value:38},
    uRearFogEnd:{value:56},
    uTime:{value:0}
  },
  vertexShader:`
    varying vec2 vUv;
    void main(){
      vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
    }
  `,
  fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform mat4 uProjectionMatrixInverse;
    uniform mat4 uCameraMatrixWorld;
    uniform vec3 uFogColor;
    uniform float uFogCenterX,uFogCenterZ,uFogStart,uFogEnd,uRearFogStart,uRearFogEnd,uDensity,uTime,uRadialMode;
    varying vec2 vUv;

    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}

    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);
      f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
    }

    vec3 worldPosition(float depth){
      vec4 clip=vec4(vUv*2.0-1.0,depth*2.0-1.0,1.0);
      vec4 view=uProjectionMatrixInverse*clip;
      view/=view.w;
      return (uCameraMatrixWorld*view).xyz;
    }

    void main(){
      vec4 source=texture2D(tDiffuse,vUv);
      float depth=texture2D(tDepth,vUv).x;
      if(depth>=0.99999){gl_FragColor=source;return;}

      vec3 world=worldPosition(depth);

        float fog;
        if(uRadialMode>0.5){
          float worldDistance=distance(world.xz,vec2(uFogCenterX,uFogCenterZ));
          fog=smoothstep(uFogStart,uFogEnd,worldDistance);
        }else{
          float sideDistance=abs(world.x-uFogCenterX);
          float sideFog=smoothstep(uFogStart,uFogEnd,sideDistance);
          float rearDistance=-world.z;
          float rearFog=smoothstep(uRearFogStart,uRearFogEnd,rearDistance);
          fog=max(sideFog,rearFog);
        }

      float n=noise(world.xz*.075+vec2(uTime*.025,-uTime*.018));
      fog=clamp(fog*(.82+n*.28)*uDensity,0.0,.98);

      gl_FragColor=vec4(mix(source.rgb,uFogColor,fog),source.a);
    }
  `
};