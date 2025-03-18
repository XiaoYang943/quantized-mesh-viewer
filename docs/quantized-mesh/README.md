# quantized-mesh-1.0 terrain format

Have a question? Discuss the quantized-mesh specification on the [Cesium community forum](https://community.cesium.com/).

A terrain tileset in quantized-mesh-1.0 format is a simple multi-resolution quadtree pyramid of meshes. All tiles have the extension .terrain. So, if the Tiles URL for a tileset is:

```
http://example.com/tiles
```

Then the two root files of the pyramid are found at these URLs:

* (-180 deg, -90 deg) - (0 deg, 90 deg) - http://example.com/tiles/0/0/0.terrain
* (0 deg, -90 deg) - (180 deg, 90 deg) - http://example.com/tiles/0/1/0.terrain

The eight tiles at the next level are found at these URLs:

* (-180 deg, -90 deg) - (-90 deg, 0 deg) - http://example.com/tiles/1/0/0.terrain
* (-90 deg, -90 deg) - (0 deg, 0 deg) - http://example.com/tiles/1/1/0.terrain
* (0 deg, -90 deg) - (90 deg, 0 deg) - http://example.com/tiles/1/2/0.terrain
* (90 deg, -90 deg) - (180 deg, 0 deg) - http://example.com/tiles/1/3/0.terrain
* (-180 deg, 0 deg) - (-90 deg, 90 deg) - http://example.com/tiles/1/0/1.terrain
* (-90 deg, 0 deg) - (0 deg, 90 deg) - http://example.com/tiles/1/1/1.terrain
* (0 deg, 0 deg) - (90 deg, 90 deg) - http://example.com/tiles/1/2/1.terrain
* (90 deg, 0 deg) - (180 deg, 90 deg) - http://example.com/tiles/1/3/1.terrain

When requesting tiles, be sure to include the following HTTP header in the request:
```
Accept: application/vnd.quantized-mesh,application/octet-stream;q=0.9
```

Otherwise, some servers may return a different representation of the tile than the one described here.

Each tile is a specially-encoded triangle mesh where vertices overlap their neighbors at tile edges.
每一个瓦片都是一个经过特殊编码的三角形网格，其中顶点在瓦片边缘与相邻顶点重叠(相邻的瓦片共享顶点)

In other words, at the root, the eastern-most vertices in the western tile have the same longitude as the western-most vertices in the eastern tile.
在根节点，西边瓦片中最东边的顶点与东边瓦片中最西边的顶点具有相同的经度(相邻的瓦片经度相同)。

Terrain tiles are served gzipped. Once extracted, tiles are little-endian, binary data. 
地形瓦片以 gzip 格式提供。一旦解压，瓦片就是小端二进制数据(buffer需要使用小端字节序来存储数据)。
## QuantizedMeshHeader
The first part of the file is a header with the following format. Doubles are IEEE 754 64-bit floating-point numbers, and Floats are IEEE 754 32-bit floating-point numbers.
文件的第一部分是标头，格式如下。双精度数是 IEEE 754 64 位浮点数，浮点数是 IEEE 754 32 位浮点数。
```C++
struct QuantizedMeshHeader
{
    // The center of the tile in Earth-centered Fixed coordinates.
    // 瓦片的中心点在地心固定坐标系中的坐标
    double CenterX;
    double CenterY;
    double CenterZ;

    // The minimum and maximum heights in the area covered by this tile.
    // The minimum may be lower and the maximum may be higher than
    // the height of any vertex in this tile in the case that the min/max vertex
    // was removed during mesh simplification, but these are the appropriate
    // values to use for analysis or visualization.
    
    // 此瓦片所覆盖区域中的最小和最大高度。
    // 如果在网格简化过程中移除了最小/最大顶点，则最小值可能低于此瓦片中任何顶点的高度，最大值可能高于此瓦片中任何顶点的高度，但这些值适合用于分析或可视化。
    float MinimumHeight;
    float MaximumHeight;

    // The tile’s bounding sphere.  The X,Y,Z coordinates are again expressed
    // in Earth-centered Fixed coordinates, and the radius is in meters.
    // 瓦片的包围球。X、Y、Z 坐标再次以地心固定坐标表示，半径以米为单位。
    double BoundingSphereCenterX;
    double BoundingSphereCenterY;
    double BoundingSphereCenterZ;
    double BoundingSphereRadius;

    // The horizon occlusion point, expressed in the ellipsoid-scaled Earth-centered Fixed frame.
    // If this point is below the horizon, the entire tile is below the horizon.
    // See http://cesiumjs.org/2013/04/25/Horizon-culling/ for more information.
    
    // 地平线遮挡点，以椭圆体尺度的地心固定框架表示。如果该点位于地平线以下，则整个瓦片位于地平线以下。
    double HorizonOcclusionPointX;
    double HorizonOcclusionPointY;
    double HorizonOcclusionPointZ;
};
```
## VertexData
Immediately following the header is the vertex data. An `unsigned int` is a 32-bit unsigned integer and an `unsigned short` is a 16-bit unsigned integer.
紧接着头部的是顶点数据。一个unsigned int是 32 位无符号整数，一个unsigned short是 16 位无符号整数。
```C++
struct VertexData
{
    unsigned int vertexCount;   // 顶点数量
    unsigned short u[vertexCount];  // 水平方向坐标（经度）。
    unsigned short v[vertexCount];  // 垂直方向坐标（纬度）。 
    unsigned short height[vertexCount]; // 顶点高度。
};
```

The `vertexCount` field indicates the size of the three arrays that follow. The three arrays contain the delta from the previous value that is then zig-zag encoded in order to make small integers, regardless of their sign, use a small number of bits. Decoding a value is straightforward:
该vertexCount字段指示后面三个数组的大小。这三个数组包含与前一个值的差值，然后对其进行锯齿形编码，以使小整数（无论其符号如何）使用较少的位数。解码值很简单：
```javascript
var u = 0;
var v = 0;
var height = 0;

function zigZagDecode(value) {
    return (value >> 1) ^ (-(value & 1));
}

for (i = 0; i < vertexCount; ++i) {
    u += zigZagDecode(uBuffer[i]);
    v += zigZagDecode(vBuffer[i]);
    height += zigZagDecode(heightBuffer[i]);

    uBuffer[i] = u;
    vBuffer[i] = v;
    heightBuffer[i] = height;
}
```

Once decoded, the meaning of a value in each array is as follows:
解码后，每个数组中的值的含义如下：

| Field | Meaning |
| ----- | ------- |
| u | The horizontal coordinate of the vertex in the tile. When the u value is 0, the vertex is on the Western edge of the tile. When the value is 32767, the vertex is on the Eastern edge of the tile. For other values, the vertex's longitude is a linear interpolation between the longitudes of the Western and Eastern edges of the tile. |
| v | The vertical coordinate of the vertex in the tile. When the v value is 0, the vertex is on the Southern edge of the tile. When the value is 32767, the vertex is on the Northern edge of the tile. For other values, the vertex's latitude is a linear interpolation between the latitudes of the Southern and Nothern edges of the tile. |
| height | The height of the vertex in the tile. When the height value is 0, the vertex's height is equal to the minimum height within the tile, as specified in the tile's header. When the value is 32767, the vertex's height is equal to the maximum height within the tile. For other values, the vertex's height is a linear interpolation between the minimum and maximum heights. |

u:顶点在瓦片中的水平坐标。当 u 值为 0 时，顶点位于瓦片的西边。当该值为 32767 时，顶点位于瓦片的东边。对于其他值，顶点的经度是瓦片西边和东边经度之间的线性插值。
v:顶点在瓦片中的垂直坐标。当 v 值为 0 时，顶点位于瓦片的南边。当值为 32767 时，顶点位于瓦片的北边。对于其他值，顶点的纬度是瓦片南边和北边纬度之间的线性插值。
height:瓦片中顶点的高度。当高度值为 0 时，顶点的高度等于瓦片内最小高度，如瓦片标题中指定。当值为 32767 时，顶点的高度等于瓦片内最大高度。对于其他值，顶点的高度是最小高度和最大高度之间的线性插值。

## IndexData
Immediately following the vertex data is the index data. Indices specify how the vertices are linked together into triangles. If tile has more than 65536 vertices, the tile uses the `IndexData32` structure to encode indices. Otherwise, it uses the `IndexData16` structure.
紧接着顶点数据的是索引数据。索引指定如何将顶点连接在一起形成三角形。如果瓦片有超过 65536 个顶点，则瓦片使用IndexData32结构来编码索引。否则，它使用IndexData16结构。

To enforce proper byte alignment, padding is added before the IndexData to ensure 2 byte alignment for `IndexData16` and 4 byte alignment for `IndexData32`.
为了强制正确的字节对齐，在 IndexData 之前添加了填充，以确保 的 2 字节对齐IndexData16和 的 4 字节对齐IndexData32。
```C++
struct IndexData16
{
    unsigned int triangleCount;  // 三角形数量。
    unsigned short indices[triangleCount * 3];  // 构成三角形的顶点索引。
}

struct IndexData32
{
    unsigned int triangleCount;
    unsigned int indices[triangleCount * 3];
}
```

Indices are encoded using the high water mark encoding from [webgl-loader](https://code.google.com/p/webgl-loader/). Indices are decoded as follows:
索引使用来自webgl-loader的高水位标记编码进行编码。索引解码如下：
```javascript
var highest = 0;
for (var i = 0; i < indices.length; ++i) {
    var code = indices[i];
    indices[i] = highest - code;
    if (code === 0) {
        ++highest;
    }
}
```

## EdgeIndices
Each triplet of indices specifies one triangle to be rendered, in counter-clockwise winding order. Following the triangle indices is four more lists of indices:
每个索引三元组指定一个要渲染的三角形，按逆时针旋转顺序排列。三角形索引后面是另外四个索引列表：
```C++
struct EdgeIndices16
{
    unsigned int westVertexCount;
    unsigned short westIndices[westVertexCount];

    unsigned int southVertexCount;
    unsigned short southIndices[southVertexCount];

    unsigned int eastVertexCount;
    unsigned short eastIndices[eastVertexCount];

    unsigned int northVertexCount;
    unsigned short northIndices[northVertexCount];
}

struct EdgeIndices32
{
    unsigned int westVertexCount;
    unsigned int westIndices[westVertexCount];

    unsigned int southVertexCount;
    unsigned int southIndices[southVertexCount];

    unsigned int eastVertexCount;
    unsigned int eastIndices[eastVertexCount];

    unsigned int northVertexCount;
    unsigned int northIndices[northVertexCount];
}
```

These index lists enumerate the vertices that are on the edges of the tile. It is helpful to know which vertices are on the edges in order to add skirts to hide cracks between adjacent levels of detail.
这些索引列表列举了瓦片边缘上的顶点。了解哪些顶点位于边缘上很有帮助，这样可以添加裙边来隐藏相邻细节级别之间的裂缝。

## Tiling Scheme and Coordinate System

By default, the data is tiled according to the [Tile Map Service (TMS)](http://wiki.osgeo.org/wiki/Tile_Map_Service_Specification) layout and global-geodetic system. These defaults can be varied by specifying the `projection` and `scheme`.
默认情况下，数据根据Tile Map Service (TMS)布局和全球大地测量系统进行平铺。可以通过指定projection和 来更改这些默认值scheme。

Allowed values for the projection are `EPSG:3857` ([Web Mercator](https://en.wikipedia.org/wiki/Web_Mercator_projection) as used by Google Maps) and `EPSG:4326` (Lat/Lng coordinates in the [Global-Geodetic System](https://en.wikipedia.org/wiki/World_Geodetic_System)). It is worth noting that the `EPSG3857` projection has only 1 tile at the root (zoom level 0) while `EPSG:4326` has 2.
投影的允许值为EPSG:3857（Google 地图使用的Web Mercator ）和（全球大地测量系统EPSG:4326中的纬度/经度坐标）。值得注意的是，投影在根部（缩放级别 0）只有 1 个图块，而有 2 个。EPSG3857EPSG:4326

The options for the tiling scheme are `tms` and `slippyMap`. The Y coordinates are numbered from the south northwards (eg. latitudes) in the `tms` standard whereas `slippyMap` coordinates have their origin at top left (NW).
平铺方案的选项是tms和slippyMap。标准中 Y 坐标从南向北编号（例如纬度），tms而slippyMap坐标的原点位于左上角（西北）。

For Cesium terrain layers these options can be set in the `layer.json` manifest file. If not specified, they default
to `EPSG:4326` and `tms`.
对于 Cesium 地形层，这些选项可以在清单文件中设置layer.json。如果未指定，则默认为EPSG:4326和tms。

## Extensions
Extension data may follow to supplement the quantized-mesh with additional information. Each extension begins with an `ExtensionHeader`, consisting of a unique identifier and the size of the extension data in bytes. An `unsigned char` is a 8-bit unsigned integer.
扩展数据可以随后补充量化网格的附加信息。每个扩展都以 开头ExtensionHeader，由唯一标识符和扩展数据的大小（以字节为单位）组成。unsigned char是一个 8 位无符号整数。
```C++
struct ExtensionHeader
{
    unsigned char extensionId;
    unsigned int extensionLength;
}
```

As new extensions are defined, they will be assigned a unique identifier. If no extensions are defined for the tileset, an `ExtensionHeader` will not included in the quanitzed-mesh. Multiple extensions may be appended to the quantized-mesh data, where ordering of each extension is determined by the server.
定义新扩展时，将为它们分配一个唯一标识符。如果没有为图块集定义扩展，则ExtensionHeader不会包含在量化网格中。可以将多个扩展附加到量化网格数据中，其中每个扩展的顺序由服务器确定。

Multiple extensions may be requested by the client by delimiting extension names with a `-`. For example, a client can request vertex normals and watermask using the following Accept header:
客户端可以通过用 分隔扩展名来请求多个扩展-。例如，客户端可以使用以下 Accept 标头请求顶点法线和水罩：
```
Accept : 'application/vnd.quantized-mesh;extensions=octvertexnormals-watermask'
```

The following extensions may be defined for a quantized-mesh:
可以为量化网格定义以下扩展：

### Terrain Lighting

__Name:__ Oct-Encoded Per-Vertex Normals

__Id:__ 1

__Description:__ Adds per vertex lighting attributes to the quantized-mesh. Each vertex normal uses oct-encoding to compress the traditional x, y, z 96-bit floating point unit vector into an x,y 16-bit representation. The 'oct' encoding is described in "A Survey of Efficient Representations of Independent Unit Vectors", Cigolle et al 2014: http://jcgt.org/published/0003/02/01/

__Data Definition:__
```C++
struct OctEncodedVertexNormals
{
    unsigned char xy[vertexCount * 2];
}
```

__Requesting:__ For oct-encoded per-vertex normals to be included in the quantized-mesh, the client must request this extension by using the following HTTP Header:
```
Accept : 'application/vnd.quantized-mesh;extensions=octvertexnormals'
```

__Comments:__ The original implementation of this extension was requested using the extension name `vertexnormals`. The `vertexnormals` extension identifier is deprecated and implementations must now request vertex normals by adding `octvertexnormals` in the request header extensions parameter, as shown above.

### Water Mask
__Name:__ Water Mask

__Id:__ 2

__Description:__ Adds coastline data used for rendering water effects. The water mask is either 1 byte, in the case that the tile is all land or all water, or it is `256 * 256 * 1 = 65536` bytes if the tile has a mix of land and water. Each mask value is 0 for land and 255 for water. Values in the mask are defined from north-to-south, west-to-east; the first byte in the mask defines the watermask value for the northwest corner of the tile. Values between 0 and 255 are allowed as well in order to support anti-aliasing of the coastline.

__Data Definition:__

A Terrain Tile covered entirely by land or water is defined by a single byte.
```C++
struct WaterMask
{
    unsigned char mask;
}
```

A Terrain Tile containing a mix of land and water define a 256 x 256 grid of height values.

```C++
struct WaterMask
{
    unsigned char mask[256 * 256];
}
```

__Requesting:__ For the watermask to be included in the quantized-mesh, the client must request this extension by using the following HTTP Header:
```
Accept : 'application/vnd.quantized-mesh;extensions=watermask'
```

### Metadata
__Name:__ Metadata

__Id:__ 4

__Description:__ Adds a JSON object to each tile that can store extra information about the tile. Potential uses include storing the what type of land is in the tile (eg. forest, desert, etc) or availability of child tiles.

__Data Definition:__

```C++
struct Metadata
{
    unsigned int jsonLength;
    char json[jsonLength];
}
```

__Requesting:__ For the metadata to be included in the quantized-mesh, the client must request this extension by using the following HTTP Header:
```
Accept : 'application/vnd.quantized-mesh;extensions=metadata'
```
