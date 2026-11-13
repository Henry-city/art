SOLWAVE 参考图微波炉 / Blender 参数化模型

主文件：microwave_solwave.blend（闭门）
开门文件：microwave_solwave_open.blend（105°编辑展示姿态）
审阅入口：index.html
原生视觉导出：microwave_solwave_visual.usdc

本模型用 Blender 5.2.0 LTS 的 Python API 从几何原语生成。按本项目的
结构/外观分离、分件命名、来源记录、独立 attempt 和输出隔离规则组织。
参考了现有模板的参数契约，未复制其他旧微波炉网格或继承其物理通过结论。

参数文件：parameters.json（几何），materials.json（光学外观）。
脚本：build.py；独立读取核查：audit.py；装配层级：assembly.json。
字体与原始参考图已打包进 .blend。重新执行脚本使用 Windows Arial 字体。

复现示例（输出目录必须为新目录；替换 ATTEMPT_NEW）：
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python 'D:/generate/physics/phyart/outputs/solwave_reference_v003/build.py' -- --output 'D:/generate/physics/phyart/work/solwave_reference_v003/ATTEMPT_NEW' --samples 128 --resolution 1600

在 Blender 中，选择 ASSEMBLY_Door_PIVOT_Z，将 Z 旋转设为 -105° 可查看开门。
门的拉手、玻璃、防护网和内框会随该编辑父级一起运动。
这是编辑层级，不是物理关节或受力测试。

尺寸依据：单张参考照片未给尺寸。采用箱体宽 550、深 445、高 332 mm 的
工程估计，箱体底面距地 14 mm；含拉手和支脚的模型包围盒约
550 × 514.1 × 346 mm。绝对尺寸、隐蔽结构不能视为厂家规格。
内腔、背面、铰链、锁钩为工程补全；面板微小文字为版式近似。
本轮没有运行 Isaac Sim，未建立碰撞代理、质量、惯量或接触力律。
USD 的通用材质近似 Blender 拉丝与玻璃，以 .blend 为外观主文件。

核查结果详见 geometry_audit.json：保存后重新读取，18 个散热口穿孔检查，
25,629 个防护网孔，USD 重新导入的包围盒与源文件一致。
这些结果只确认几何/导出，不表示机械功能或定量物理验收通过。

V003 修订：控制面板与门金属面仍使用共同的 Y=-244 mm 正面，黑色控制板内凹 2.2 mm，槽底深度 2.8 mm。
内腔前口采用共享顶点的圆弧过渡，与机身进行实体联合；移除独立浮置的内壁和底板。
单一连通网格、非流形边数以及 9 个截面、36 条内壁射线结果见 geometry_audit.json。
保留 V002 的圆角：机身 6 mm，门轮廓 7 mm，前缘 2.8 mm。所有深度、半径均为工程比例估计。
