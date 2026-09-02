export function disposeObject3D(root) {
  root.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose();
    }

    if (object.material) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value && value.isTexture) {
            value.dispose();
          }
        }

        material.dispose();
      }
    }
  });
}
