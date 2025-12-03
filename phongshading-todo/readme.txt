# 光栅化场景渲染代码使用说明文档
## 一、项目背景
实现了**纹理加载、Phong光照、PCF软阴影**（基础要求）及**场景雾化特效**（附加项），完成3D场景渲染需求。

## 二、文件修改清单
### 1. `configTexture.js`（纹理加载）
**功能**：创建2D纹理对象，配置参数并加载图片，返回可绑定的纹理对象。

```javascript
// TODO1：创建2D颜色纹理对象并加载图片
function configureTexture(image) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    return texture;
}
```

### 2. `/shader/box.frag`（光照+阴影+雾化）
**功能**：整合Phong光照、PCF软阴影、雾化计算，输出最终像素颜色。

```glsl
#version 300 es
precision mediump float;
out vec4 FragColor;

uniform float ambientStrength, specularStrength, diffuseStrength, shininess;
in vec3 Normal;
in vec3 FragPos;
in vec2 TexCoord;
in vec4 FragPosLightSpace;
uniform vec3 viewPos;
uniform vec4 u_lightPosition; 
uniform vec3 lightColor;
uniform sampler2D diffuseTexture;
uniform sampler2D depthTexture;
uniform samplerCube cubeSampler;

// 阴影计算（TODO3）
uniform float bias;
uniform vec2 depthTextureSize;
float texelSize = 1.0 / depthTextureSize;

float shadowCalculation(vec4 fragPosLightSpace, vec3 normal, vec3 lightDir) {
    float shadow = 0.0;
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    projCoords = projCoords * 0.5 + 0.5;
    float closestDepth = texture(depthTexture, projCoords.xy).r;
    float currentDepth = projCoords.z;
    bias = max(0.005 * (1.0 - dot(normal, lightDir)), 0.0005);
    
    for(int x = -1; x <= 1; ++x) {
        for(int y = -1; y <= 1; ++y) {
            float pcfDepth = texture(depthTexture, projCoords.xy + vec2(x, y) * texelSize).r;
            shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;
        }
    }
    shadow /= 9.0;
    return shadow;
}

// Phong光照计算（TODO2）
vec3 calculatePhongLight(vec3 norm, vec3 lightDir, vec3 viewDir) {
    vec3 ambient = ambientStrength * lightColor;
    float diff = max(dot(norm, lightDir), 0.0);
    vec3 diffuse = diffuseStrength * diff * lightColor;
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(norm, halfDir), 0.0), shininess);
    vec3 specular = specularStrength * spec * lightColor;
    return ambient + diffuse + specular;
}

// 雾化计算
uniform float fogDensity;
uniform vec3 fogColor;
uniform float fogStart;
uniform float fogEnd;

float getFogFactorLinear(float distance) {
    return clamp((distance - fogStart) / (fogEnd - fogStart), 0.0, 1.0);
}
float getFogFactorExp(float distance) {
    return 1.0 - exp(-fogDensity * distance);
}
float getFogFactorExp2(float distance) {
    return 1.0 - exp(-pow(fogDensity * distance, 2.0));
}

// 主函数
void main() {
    vec3 norm = normalize(Normal);
    vec3 lightDir = u_lightPosition.w == 1.0 ? normalize(u_lightPosition.xyz - FragPos) : normalize(u_lightPosition.xyz);
    vec3 viewDir = normalize(viewPos - FragPos);
    float distance = length(FragPos - viewPos);

    vec3 textureColor = texture(diffuseTexture, TexCoord).xyz;
    vec3 phongLightColor = calculatePhongLight(norm, lightDir, viewDir);
    float shadow = shadowCalculation(FragPosLightSpace, norm, lightDir);
    vec3 resultColor = (1.0 - shadow / 2.0) * phongLightColor * textureColor;

    float fogFactor = getFogFactorLinear(distance);
    // float fogFactor = getFogFactorExp(distance);
    // float fogFactor = getFogFactorExp2(distance);
    vec3 finalColor = mix(resultColor, fogColor, fogFactor);

    FragColor = vec4(finalColor, 1.0);
}
```

### 3. `Phongshading.js`（参数初始化）
**功能**：初始化光照、阴影、雾化参数，并传递给Shader。

```javascript
var fogDensity, fogColor, fogStart, fogEnd;
var ambientStrength = 0.1, diffuseStrength = 0.8, specularStrength = 0.5, shininess = 32.0;
var shadowBias = 0.005, depthTextureSize = [1024, 1024];

function initParameters(){
    // 雾化参数初始化
    fogDensity = 0.015;
    fogColor = vec3(0.737255, 0.745098, 0.752941);
    fogStart = 5.0;
    fogEnd = 50.0;
};

function render(){	
    gl.useProgram(program);

    // 传递光照参数
    gl.uniform1f(gl.getUniformLocation(program, "ambientStrength"), ambientStrength);
    gl.uniform1f(gl.getUniformLocation(program, "diffuseStrength"), diffuseStrength);
    gl.uniform1f(gl.getUniformLocation(program, "specularStrength"), specularStrength);
    gl.uniform1f(gl.getUniformLocation(program, "shininess"), shininess);

    // 传递阴影参数
    gl.uniform1f(gl.getUniformLocation(program, "bias"), shadowBias);
    gl.uniform2fv(gl.getUniformLocation(program, "depthTextureSize"), depthTextureSize);

    // 传递雾化参数
    gl.uniform1f(gl.getUniformLocation(program, "fogDensity"), fogDensity);
    gl.uniform3fv(gl.getUniformLocation(program, "fogColor"), flatten(fogColor));
    gl.uniform1f(gl.getUniformLocation(program, "fogStart"), fogStart);
    gl.uniform1f(gl.getUniformLocation(program, "fogEnd"), fogEnd);

    // 原有绘制代码
}
```

### 4. `/shader/skybox.frag`（天空盒雾化）
**功能**：为天空盒添加雾化效果，保持场景视觉一致。

```glsl
#version 300 es
precision mediump float;
out vec4 FragColor;

in vec3 TexCoords;
in float FogDistance;
uniform samplerCube cubeSampler;

uniform float fogDensity;
uniform vec3 fogColor;
uniform float fogStart;
uniform float fogEnd;

float getFogFactorLinear(float distance) {
    return clamp((distance - fogStart) / (fogEnd - fogStart), 0.0, 1.0);
}

void main() {    
    vec4 originalColor = texture(cubeSampler, TexCoords);
    float fogFactor = getFogFactorLinear(FogDistance);
    vec3 finalColor = mix(originalColor.rgb, fogColor, fogFactor);
    
    FragColor = vec4(finalColor, originalColor.a);
}
```

## 三、注意事项
1. 纹理加载需在图片加载完成后执行（`image.onload`回调）；
2. `FragPosLightSpace`需正确计算（光源投影矩阵×模型视图矩阵×顶点位置）；
3. 天空盒`FogDistance`在顶点着色器计算：`FogDistance = length(viewPos - gl_Position.xyz);`；
4. PCF采样数建议≤16，深度纹理尺寸≤2048x2048；
5. 雾色、环境光颜色需与背景协调。

## 四、效果说明
### 核心功能
- 纹理：物体表面显示清晰纹理，与光照融合；
- 光照：环境光补全暗部，漫反射随光线夹角变化，镜面高光集中；
- 阴影：无失真，边缘平滑，阴影区域不黑屏。

### 附加功能
- 雾化：物体/天空盒随距离渐变雾色，支持线性/指数/指数平方雾模式，增强场景深度。