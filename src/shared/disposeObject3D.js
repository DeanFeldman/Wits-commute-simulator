export function disposeObject3D(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  const disposeTexture = (texture) => {
    if (texture?.isTexture && !textures.has(texture)) {
      textures.add(texture);
      texture.dispose();
    }
  };

  const disposeMaterial = (material) => {
    if (!material || materials.has(material)) {
      return;
    }

    materials.add(material);

    for (const value of Object.values(material)) {
      disposeTexture(value);
    }

    for (const uniform of Object.values(material.uniforms ?? {})) {
      disposeTexture(uniform.value);
    }

    material.dispose();
  };

  root.traverse((object) => {
    if (object.geometry && !geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      object.geometry.dispose();
    }

    if (Array.isArray(object.material)) {
      for (const material of object.material) {
        disposeMaterial(material);
      }
    } else {
      disposeMaterial(object.material);
    }
  });
}
