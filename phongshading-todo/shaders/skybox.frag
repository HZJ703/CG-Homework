#version 300 es
precision mediump float;

out vec4 FragColor;

in vec3 TexCoords;
in float FogDistance;  // 需要在顶点着色器中传递距离

uniform samplerCube cubeSampler;

// 添加雾化uniform
uniform float fogDensity;
uniform vec3 fogColor;
uniform float fogStart;
uniform float fogEnd;

float getFogFactorLinear(float distance)
{
    return clamp((distance - fogStart) / (fogEnd - fogStart), 0.0, 1.0);
}

void main()
{    
    vec4 originalColor = texture(cubeSampler, TexCoords);
    
    // 计算雾化因子
    float fogFactor = getFogFactorLinear(FogDistance);
    
    // 应用雾化效果
    vec3 finalColor = mix(originalColor.rgb, fogColor, fogFactor);
    
    FragColor = vec4(finalColor, originalColor.a);
}