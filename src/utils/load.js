export function loadMesh(path) {
    return window.fetch(path)
        .then(res => {
            if (res.status !== 200) {
                throw new Error('Could not load the mesh')
            }

            return res.arrayBuffer()
        })
}
