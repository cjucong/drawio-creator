# DrawIO Creator 插件安装和使用指南

## 安装步骤

### 方法一：手动安装（推荐）

1. 下载插件的发布版本（如果有）或克隆本仓库
2. 将插件文件放置在 Obsidian 库的 `.obsidian/plugins/drawio-creator` 目录下
   - 确保 `main.js`、`manifest.json`、`styles.css` 和 `data.json` 文件都存在于该目录中
3. 重新启动 Obsidian
4. 打开 Obsidian 设置，进入 "第三方插件" 选项卡
5. 在已安装插件列表中找到 "DrawIO Creator"，并启用它
6. 如果看到安全提示，请允许插件运行（因为此插件需要运行外部程序）

### 方法二：使用 BRAT 安装（如果你已经安装了 BRAT 插件）

1. 在 Obsidian 中打开设置
2. 找到 "BRAT" 设置选项卡
3. 点击 "添加 Beta 插件"
4. 输入本仓库的 URL
5. 点击 "添加插件"
6. 等待 BRAT 安装完成
7. 在 "第三方插件" 选项卡中启用 "DrawIO Creator"

## 配置插件

1. 在 Obsidian 设置中，找到 "DrawIO Creator" 设置选项卡
2. 根据需要调整以下设置：
   - **DrawIO 程序路径**：指定 DrawIO 桌面程序的安装路径（默认为 `E:\Software\Drawio\draw.io\draw.io.exe`）
   - **保存文件夹路径**：指定 DrawIO 文件的保存位置（默认为 `附件/drawio`）
   - **文件格式**：选择保存的文件格式（SVG 或 PNG）

## 使用方法

### 创建新的 DrawIO 图表

1. 在 Markdown 编辑器中，将光标放置在你想插入图表的位置
2. 右键单击弹出上下文菜单
3. 选择 "创建DrawIO图表" 选项
4. 外部 DrawIO 程序将自动启动
5. 在 DrawIO 中创建并编辑你的图表
6. 保存图表（Ctrl+S）并关闭 DrawIO
7. 返回 Obsidian，图表链接将自动插入到光标位置

### 编辑现有的 DrawIO 图表

要编辑已有的图表，你可以：

1. 在 Obsidian 的文件浏览器中找到该图表文件
2. 右键单击文件，选择 "在默认应用中打开"
3. 或者直接在系统文件浏览器中找到该文件并双击打开
4. 在 DrawIO 中编辑后保存，Obsidian 中的图表将自动更新

## 排障指南

如果遇到问题，请检查：

1. **DrawIO 路径不正确**：
   - 确保在设置中指定的 DrawIO 程序路径是正确的
   - 通过系统文件浏览器验证该路径是否存在

2. **权限问题**：
   - 确保 Obsidian 有足够权限执行外部程序
   - 在某些安全设置严格的系统中，可能需要以管理员身份运行 Obsidian

3. **插件未正确加载**：
   - 尝试重启 Obsidian
   - 检查插件是否在设置中被正确启用

4. **图表不显示**：
   - 确保图表文件确实存在于指定位置
   - 检查 Obsidian 中的文件链接格式是否正确（应为 `![[文件路径]]`）

如有其他问题，请在插件仓库提交 Issue。 