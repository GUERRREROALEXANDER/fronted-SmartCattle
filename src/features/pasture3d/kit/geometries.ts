import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  SphereGeometry,
} from 'three'

export const unitBoxGeometry = new BoxGeometry(1, 1, 1)
export const unitSphereGeometry = new SphereGeometry(1, 8, 6)
export const unitCylinderGeometry = new CylinderGeometry(1, 1, 1, 6)
export const taperedCylinderGeometry = new CylinderGeometry(0.82, 1, 1, 6)
export const unitConeGeometry = new ConeGeometry(1, 1, 7)
export const rockGeometry = new IcosahedronGeometry(1, 0)
export const foliageGeometry = new IcosahedronGeometry(1, 1)

export const fencePostGeometry = new CylinderGeometry(0.09, 0.11, 1, 5)
export const fenceWireGeometry = new CylinderGeometry(0.014, 0.014, 1, 4)

export const barnGableGeometry = new BufferGeometry()
barnGableGeometry.setAttribute(
  'position',
  new Float32BufferAttribute([
    0, 2.35, -2,
    0, 2.35, 2,
    0, 3.55, 0,
  ], 3),
)
barnGableGeometry.setIndex([0, 2, 1])
barnGableGeometry.computeVertexNormals()

export const cameraViewConeGeometry = new ConeGeometry(1.45, 4.4, 12, 1, true)
  .rotateZ(Math.PI / 2)
  .translate(2.2, 0, 0)
