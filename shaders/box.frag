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

// 添加雾化uniform
uniform float fogDensity;
uniform vec3 fogColor;
uniform float fogStart;
uniform float fogEnd;

float shadowCalculation(vec4 fragPosLightSpace, vec3 normal, vec3 lightDir)
{
    float shadow=0.0;
    /*TODO3: 添加阴影计算，返回1表示是阴影，返回0表示非阴影*/
    // 执行透视除法，将裁剪空间坐标转换到NDC空间 [-1, 1]
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    
    // 将NDC坐标从 [-1, 1] 转换到纹理坐标空间 [0, 1]
    projCoords = projCoords * 0.5 + 0.5;
    
    // 检查是否在光源视锥体范围内
    if(projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 
       || projCoords.y < 0.0 || projCoords.y > 1.0) {
        return 0.0;  // 超出范围，不在阴影中
    }
    
    // 从深度贴图中采样最近的深度值
    float closestDepth = texture(depthTexture, projCoords.xy).r;
    
    // 获取当前片元在光源空间的深度
    float currentDepth = projCoords.z;
    
    // 添加偏移以减少阴影失真(shadow acne)
    float bias = max(0.005 * (1.0 - dot(normal, lightDir)), 0.0005);
    
    // PCF软阴影(可选，提高阴影质量)
    vec2 texelSize = 1.0 / vec2(textureSize(depthTexture, 0));
    for(int x = -1; x <= 1; ++x) {
        for(int y = -1; y <= 1; ++y) {
            float pcfDepth = texture(depthTexture, projCoords.xy + vec2(x, y) * texelSize).r;
            shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;
        }
    }
    shadow /= 9.0;  // 平均9个采样点
    return shadow;
}

// 雾化计算函数 - 线性雾
float getFogFactorLinear(float distance)
{
    return clamp((distance - fogStart) / (fogEnd - fogStart), 0.0, 1.0);
}

// 雾化计算函数 - 指数雾
float getFogFactorExp(float distance)
{
    return 1.0 - exp(-fogDensity * distance);
}

// 雾化计算函数 - 指数平方雾
float getFogFactorExp2(float distance)
{
    return 1.0 - exp(-pow(fogDensity * distance, 2.0));
}

void main()
{
    // 计算片段到相机的距离
    float distance = length(FragPos - viewPos);
    
    // 采样纹理颜色
    vec3 TextureColor = texture(diffuseTexture, TexCoord).xyz;

    // 计算光照颜色
    vec3 norm = normalize(Normal);
    vec3 lightDir;
    if(u_lightPosition.w==1.0) 
        lightDir = normalize(u_lightPosition.xyz - FragPos);
    else lightDir = normalize(u_lightPosition.xyz);
    vec3 viewDir = normalize(viewPos - FragPos);
    vec3 halfDir = normalize(viewDir + lightDir);

    /*TODO2:根据phong shading方法计算ambient,diffuse,specular*/
    vec3 ambient, diffuse, specular;

    // 1. 环境光计算
    ambient = ambientStrength * lightColor;

    // 2. 漫反射计算
    float diff = max(dot(norm, lightDir), 0.0);
    diffuse = diffuseStrength * diff * lightColor;

    // 3. 镜面反射计算
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
    specular = specularStrength * spec * lightColor;
  
    vec3 lightReflectColor = (ambient + diffuse + specular);

    // 判定是否阴影，并对各种颜色进行混合
    float shadow = shadowCalculation(FragPosLightSpace, norm, lightDir);
    
    vec3 resultColor = (1.0 - shadow/2.0) * lightReflectColor * TextureColor;
    
    // 计算雾化因子（选择其中一种雾化方式）
    float fogFactor = getFogFactorLinear(distance);        // 线性雾
    // float fogFactor = getFogFactorExp(distance);        // 指数雾
    // float fogFactor = getFogFactorExp2(distance);       // 指数平方雾
    
    // 应用雾化效果
    vec3 finalColor = mix(resultColor, fogColor, fogFactor);
    
    FragColor = vec4(finalColor, 1.0);
}