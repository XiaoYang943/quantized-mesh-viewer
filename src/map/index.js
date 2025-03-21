import Cesium from 'cesium'
import SurfaceProvider from './surface-provider'
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1ODc1ZDQ0NS1jZjE4LTQzODAtYWQyOS0yNGRlNmUxYTZjNjIiLCJpZCI6OTc3MTIsImlhdCI6MTY1NTI5NjI4MH0.7eBfoYezobFOl0NzTONtoMyB1HnYcFfm9Azn6jimImU'
const container = document.getElementById('cesium-container')
const tilingScheme = new Cesium.WebMercatorTilingScheme()

const terrainProvider = new SurfaceProvider({
  getUrl: (x, y, level) => {
    const column = x
    const row = tilingScheme.getNumberOfYTilesAtLevel(level) - y - 1

    return `/example-tiles/${level}/${column}/${row}.terrain`
  },
  credit: `
    U.S.Department of the Interior, U.S. Geological Survey, 1992, 
    Standards for digital elevation models: Reston, VA
  `
})

const viewer = new Cesium.Viewer(container, {
  mapProjection: new Cesium.WebMercatorProjection(),
  sceneMode: Cesium.SceneMode.COLUMBUS_VIEW,
  terrainProvider
})

viewer.extend(Cesium.viewerCesiumInspectorMixin)

viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(
    -122.1423593,
    42.8015521,
    20000
  ),
  orientation: {
    heading: 0.0,
    pitch: -Cesium.Math.PI_OVER_TWO / 2,
    roll: 0.0
  }
})

console.log(viewer)
