'use strict';

const { Plugin, Menu, Notice, Platform, PluginSettingTab, Setting } = require('obsidian');
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// 默认设置
const DEFAULT_SETTINGS = {
    drawioPath: 'E:\\Software\\Drawio\\draw.io\\draw.io.exe',
    saveFolderPath: '附件/drawio',
    fileFormat: 'svg',  // 'svg' 或 'png'
    templatePath: '附件/drawio/空模板.svg',  // 模板文件路径
    imageWidth: '500'   // 默认图片宽度
};

class DrawioCreatorPlugin extends Plugin {
    settings = DEFAULT_SETTINGS;

    async onload() {
        console.log('加载 DrawIO Creator 插件');
        
        // 记录系统信息
        this.logSystemInfo();

        // 加载设置
        await this.loadSettings();
        
        // 检查并创建默认模板文件
        await this.checkAndCreateTemplateFile();

        // 添加设置选项卡
        this.addSettingTab(new DrawioCreatorSettingTab(this.app, this));

        // 注册右键菜单事件
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                menu.addItem((item) => {
                    item
                        .setTitle('创建DrawIO图表')
                        .setIcon('diagram-project')
                        .onClick(async () => {
                            await this.createDrawIOFile(editor, view);
                        });
                });
            })
        );
    }

    onunload() {
        console.log('卸载 DrawIO Creator 插件');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async createDrawIOFile(editor, view) {
        try {
            // 获取当前活动文件
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('无法获取当前活动文件');
                return;
            }

            // 确保保存目录存在
            const saveFolderPath = this.settings.saveFolderPath;
            
            // 分解路径，以处理多层级目录
            const pathParts = saveFolderPath.split('/');
            let currentPath = '';
            
            // 逐级检查和创建目录
            for (const part of pathParts) {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                const folder = this.app.vault.getAbstractFileByPath(currentPath);
                if (!folder) {
                    await this.app.vault.createFolder(currentPath);
                    console.log(`创建文件夹: ${currentPath}`);
                }
            }

            // 基于时间戳创建文件名
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '').replace('T', '').slice(0, 14);
            const fileName = `QuickNote-${timestamp}.${this.settings.fileFormat}`;
            const filePath = `${saveFolderPath}/${fileName}`;

            console.log(`准备创建文件: ${filePath}`);

            // 检查模板文件是否存在
            const templatePath = this.settings.templatePath;
            const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
            
            if (!templateFile) {
                const errMsg = `找不到模板文件: ${templatePath}`;
                this.showErrorWithHelpText(errMsg, [
                    '请确认模板文件路径正确',
                    '检查文件是否存在于指定位置',
                    '您可以在插件设置中修改模板文件路径'
                ]);
                return;
            }
            
            // 简化的文件复制机制
            let copySuccess = false;
            
            try {
                // 获取基础路径
                const basePath = this.app.vault.adapter.basePath;
                if (!basePath) {
                    throw new Error('无法获取Obsidian库的基础路径');
                }
                
                // 构建绝对路径
                const templateAbsolutePath = path.join(basePath, templatePath);
                const targetAbsolutePath = path.join(basePath, filePath);
                
                console.log(`模板文件绝对路径: ${templateAbsolutePath}`);
                console.log(`目标文件绝对路径: ${targetAbsolutePath}`);
                
                // 验证模板文件存在
                if (!fs.existsSync(templateAbsolutePath)) {
                    throw new Error(`模板文件不存在: ${templateAbsolutePath}`);
                }
                
                // 直接复制文件，不验证模板文件
                fs.copyFileSync(templateAbsolutePath, targetAbsolutePath);
                
                // 验证文件是否成功复制
                if (fs.existsSync(targetAbsolutePath)) {
                    const sourceStats = fs.statSync(templateAbsolutePath);
                    const targetStats = fs.statSync(targetAbsolutePath);
                    
                    console.log(`源文件大小: ${sourceStats.size} 字节`);
                    console.log(`目标文件大小: ${targetStats.size} 字节`);
                    
                    if (sourceStats.size === targetStats.size) {
                        console.log(`✅ 文件复制成功: ${targetAbsolutePath}, 大小: ${targetStats.size} 字节`);
                        copySuccess = true;
                    } else {
                        throw new Error(`文件大小不匹配: 源文件 ${sourceStats.size} 字节, 目标文件 ${targetStats.size} 字节`);
                    }
                } else {
                    throw new Error(`复制后文件不存在: ${targetAbsolutePath}`);
                }
            } catch (error) {
                console.error(`文件复制失败: ${error.message}`);
                this.showErrorWithHelpText(`无法创建DrawIO文件: ${error.message}`, [
                    '请检查模板文件是否有效',
                    '确保您有足够的权限创建文件',
                    '尝试重启Obsidian后再试'
                ]);
                return;
            }
            
            if (!copySuccess) {
                this.showErrorWithHelpText("DrawIO文件创建失败", [
                    "无法复制模板文件，可能原因：",
                    "1. 文件权限问题",
                    "2. 文件系统错误"
                ]);
                return;
            }
            
            new Notice(`DrawIO图表创建成功: ${fileName}`, 3000);
            
            // 在编辑器中插入文件链接，使用相对路径
            // 计算相对路径
            let relativePath = filePath;
            if (activeFile && activeFile.path) {
                // 获取当前文件所在目录
                const currentDir = path.dirname(activeFile.path);
                if (currentDir && currentDir !== '.') {
                    // 计算从当前文件到目标文件的相对路径
                    const dirs = currentDir.split('/');
                    const backCount = dirs.length;
                    let relPath = '';
                    for (let i = 0; i < backCount; i++) {
                        relPath += '../';
                    }
                    relativePath = relPath + filePath;
                }
            }
            
            // 在编辑器中插入文件链接，带宽度参数，使用Obsidian的[[]]格式
            const markdownLink = `![[${relativePath}|${this.settings.imageWidth}]]`;
            const cursor = editor.getCursor();
            editor.replaceRange(markdownLink, cursor);
            
            // 尝试使用DrawIO打开文件
            setTimeout(() => {
                this.openFileWithDrawIO(this.settings.drawioPath, filePath);
            }, 500);
            
        } catch (error) {
            console.error(`❌ 创建DrawIO文件时出错: ${error}`);
            this.showErrorWithHelpText(`创建DrawIO文件时出错: ${error.message}`, [
                "可能的解决方法：",
                "1. 检查模板文件路径是否正确",
                "2. 确认DrawIO程序路径设置正确",
                "3. 验证您有创建文件的权限",
                "4. 重启Obsidian后重试"
            ]);
        }
    }
    
    // 记录系统信息，帮助诊断问题
    logSystemInfo() {
        try {
            const systemInfo = {
                platform: os.platform(),
                release: os.release(),
                arch: os.arch(),
                nodejsVersion: process.version,
                obsidianPlatform: {
                    isWindows: Platform.isWindows,
                    isMacOS: Platform.isMacOS,
                    isDesktopApp: Platform.isDesktopApp,
                    isMobileApp: Platform.isMobileApp,
                }
            };
            
            console.log('系统信息:', JSON.stringify(systemInfo, null, 2));
            
            // 检查操作系统和平台检测是否一致
            if ((os.platform() === 'win32' && !Platform.isWindows) || 
                (os.platform() === 'darwin' && !Platform.isMacOS) ||
                ((os.platform() === 'linux' || os.platform() === 'freebsd') && (Platform.isWindows || Platform.isMacOS))) {
                console.warn('⚠️ 操作系统检测可能不一致! Node.js检测为:', os.platform(), '但Obsidian Platform检测为:', 
                    Platform.isWindows ? 'Windows' : Platform.isMacOS ? 'macOS' : 'Other');
            }
        } catch (error) {
            console.error('获取系统信息时出错:', error);
        }
    }

    // 显示带有帮助文本的错误通知
    showErrorWithHelpText(mainMessage, helpTexts = []) {
        console.error(mainMessage);
        
        // 创建包含主消息和帮助文本的完整消息
        let fullMessage = mainMessage;
        
        if (helpTexts && helpTexts.length > 0) {
            fullMessage += "\n\n";
            fullMessage += helpTexts.join("\n");
        }
        
        // 显示通知
        new Notice(fullMessage, 12000);
    }
    
    // 判断文件内容是否为有效的DrawIO文件
    isValidDrawIOFile(content) {
        if (!content) {
            return false;
        }
        
        try {
            // 检查DrawIO SVG文件的标志
            if (this.settings.fileFormat.toLowerCase() === 'svg') {
                // 更宽松的SVG格式验证，只要是有效的SVG文件就接受
                return content.includes('<svg') && 
                      (content.includes('content="mxfile') || 
                       content.includes('content="diagram') || 
                       content.includes('<mxfile ') || 
                       content.includes('<diagram ') ||
                       content.includes('xmlns="http://www.w3.org/2000/svg"')); // 接受标准SVG
            }
            
            // 如果是PNG格式，检查是否包含特定标记
            // 注意：这种检查可能不可靠，因为PNG是二进制格式
            if (this.settings.fileFormat.toLowerCase() === 'png') {
                // 尝试查找PNG中可能包含的文本标记
                return content.includes('mxfile') || content.includes('diagram');
            }
            
            // 默认返回true，依赖于文件大小验证
            return true;
        } catch (error) {
            console.error(`验证DrawIO文件时出错: ${error.message}`);
            return false;
        }
    }
    
    // 检测当前系统是否是Windows
    isWindowsSystem() {
        // 多种方式检测，以提高准确性
        const checks = [
            Platform.isWindows, // Obsidian API
            os.platform() === 'win32', // Node.js API
            process.platform === 'win32', // Node.js 进程API
            path.sep === '\\' // 路径分隔符检查
        ];
        
        const trueCount = checks.filter(Boolean).length;
        console.log(`Windows系统检测结果: ${trueCount}/${checks.length} 通过`);
        
        // 如果大多数检测都通过，则认为是Windows
        return trueCount >= Math.ceil(checks.length / 2);
    }
    
    // 检测当前系统是否是macOS
    isMacOSSystem() {
        // 多种方式检测，以提高准确性
        const checks = [
            Platform.isMacOS, // Obsidian API
            os.platform() === 'darwin', // Node.js API
            process.platform === 'darwin' // Node.js 进程API
        ];
        
        const trueCount = checks.filter(Boolean).length;
        console.log(`macOS系统检测结果: ${trueCount}/${checks.length} 通过`);
        
        // 如果大多数检测都通过，则认为是macOS
        return trueCount >= Math.ceil(checks.length / 2);
    }
    
    // 打开文件方法
    openFileWithDrawIO(drawioPath, filePath) {
        try {
            // 获取平台信息
            const isWin = this.isWindowsSystem();
            const isMac = this.isMacOSSystem();
            const platformName = isWin ? 'Windows' : isMac ? 'macOS' : 'Linux/其他';
            
            console.log(`准备打开文件: 当前操作系统=${platformName} (isWin=${isWin}, isMac=${isMac})`);
            console.log(`DrawIO路径: ${drawioPath}`);
            console.log(`文件路径: ${filePath}`);
            
            if (!fs.existsSync(drawioPath)) {
                const errMsg = `找不到DrawIO程序: ${drawioPath}`;
                console.error(errMsg);
                new Notice(errMsg, 8000);
                this.app.showInFolder(filePath);
                return;
            }
            
            // 获取基础路径
            const basePath = this.app.vault.adapter.basePath;
            if (!basePath) {
                const errMsg = '无法获取Obsidian库的基础路径';
                console.error(errMsg);
                new Notice(errMsg, 5000);
                this.app.showInFolder(filePath);
                return;
            }
            
            // 构建绝对路径，根据操作系统使用正确的路径分隔符
            let absoluteFilePath;
            if (isWin) {
                // 在Windows上，确保使用反斜杠，并处理UNC路径
                absoluteFilePath = path.resolve(basePath, filePath).replace(/\//g, '\\');
            } else {
                // 在macOS/Linux上使用正斜杠
                absoluteFilePath = path.resolve(basePath, filePath);
            }
            
            console.log(`文件的绝对路径: ${absoluteFilePath}`);
            
            // 验证文件是否存在
            if (!fs.existsSync(absoluteFilePath)) {
                const errMsg = `找不到要打开的文件: ${absoluteFilePath}`;
                console.error(errMsg);
                new Notice(errMsg, 8000);
                // 尝试显示文件夹
                this.app.showInFolder(filePath);
                return;
            }
            
            // 检查文件大小
            try {
                const stats = fs.statSync(absoluteFilePath);
                console.log(`文件大小: ${stats.size} 字节`);
                if (stats.size === 0) {
                    console.warn(`警告: 文件大小为0，可能无法正确打开`);
                }
            } catch (error) {
                console.error(`无法获取文件信息: ${error.message}`);
            }
            
            // 处理Windows上的路径
            if (isWin) {
                // 确保DrawIO路径使用反斜杠
                const winDrawioPath = drawioPath.replace(/\//g, '\\');
                
                try {
                    // 使用spawn方法启动进程
                    console.log(`使用spawn启动DrawIO进程...`);
                    console.log(`命令: "${winDrawioPath}" "${absoluteFilePath}"`);
                    
                    const child = spawn(winDrawioPath, [absoluteFilePath], {
                        detached: true,
                        stdio: 'ignore',
                        shell: true,
                        windowsVerbatimArguments: true
                    });
                    
                    child.unref();
                    new Notice(`已使用DrawIO打开文件: ${path.basename(filePath)}`, 3000);
                    return;
                } catch (error) {
                    console.error(`使用spawn启动失败: ${error.message}`);
                    
                    // 如果spawn失败，尝试使用start命令
                    try {
                        console.log(`尝试使用start命令...`);
                        const command = `start "" "${winDrawioPath}" "${absoluteFilePath}"`;
                        console.log(`执行命令: ${command}`);
                        
                        exec(command, { windowsHide: false }, (error, stdout, stderr) => {
                            if (error) {
                                console.error(`使用start命令失败: ${error.message}`);
                                console.error(`stderr: ${stderr}`);
                                
                                // 如果start也失败，显示文件位置
                                this.app.showInFolder(filePath);
                                new Notice(`无法自动打开文件，已显示文件所在文件夹。`, 8000);
                            } else {
                                console.log(`成功使用start命令打开文件`);
                                new Notice(`已使用DrawIO打开文件: ${path.basename(filePath)}`, 3000);
                            }
                        });
                    } catch (startError) {
                        console.error(`使用start命令出错: ${startError.message}`);
                        this.app.showInFolder(filePath);
                        new Notice(`无法自动打开文件，已显示文件所在文件夹。`, 8000);
                    }
                }
            } else if (isMac) {
                // macOS系统
                try {
                    console.log(`在macOS上打开文件...`);
                    const command = `open -a "${drawioPath}" "${absoluteFilePath}"`;
                    console.log(`执行命令: ${command}`);
                    
                    exec(command, { shell: true }, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`在macOS上打开文件失败: ${error.message}`);
                            console.error(`stderr: ${stderr}`);
                            
                            // 如果失败，显示文件位置
                            this.app.showInFolder(filePath);
                            new Notice(`无法自动打开文件，已显示文件所在文件夹。`, 8000);
                        } else {
                            console.log(`成功在macOS上打开文件`);
                            new Notice(`已使用DrawIO打开文件: ${path.basename(filePath)}`, 3000);
                        }
                    });
                } catch (error) {
                    console.error(`在macOS上打开文件出错: ${error.message}`);
                    this.app.showInFolder(filePath);
                    new Notice(`无法自动打开文件，已显示文件所在文件夹。`, 8000);
                }
            } else {
                // Linux系统
                try {
                    console.log(`在Linux上打开文件...`);
                    const command = `"${drawioPath}" "${absoluteFilePath}"`;
                    console.log(`执行命令: ${command}`);
                    
                    exec(command, { shell: true }, (error, stdout, stderr) => {
                        if (error) {
                            console.error(`在Linux上打开文件失败: ${error.message}`);
                            console.error(`stderr: ${stderr}`);
                            
                            // 尝试使用xdg-open
                            console.log(`尝试使用xdg-open...`);
                            exec(`xdg-open "${absoluteFilePath}"`, (error2, stdout2, stderr2) => {
                                if (error2) {
                                    console.error(`使用xdg-open失败: ${error2.message}`);
                                    this.app.showInFolder(filePath);
                                    new Notice(`无法自动打开文件，已显示文件所在文件夹。`, 8000);
                                } else {
                                    console.log(`成功使用xdg-open打开文件`);
                                    new Notice(`已使用系统默认程序打开文件: ${path.basename(filePath)}`, 3000);
                                }
                            });
                        } else {
                            console.log(`成功在Linux上打开文件`);
                            new Notice(`已使用DrawIO打开文件: ${path.basename(filePath)}`, 3000);
                        }
                    });
                } catch (error) {
                    console.error(`在Linux上打开文件出错: ${error.message}`);
                    this.app.showInFolder(filePath);
                    new Notice(`无法自动打开文件，已显示文件所在文件夹。`, 8000);
                }
            }
        } catch (error) {
            console.error(`❌ 打开文件时出错: ${error.message}`);
            this.app.showInFolder(filePath);
            new Notice(`无法自动打开文件: ${error.message}，已显示文件所在文件夹。`, 8000);
        }
    }

    // 检查并创建默认模板文件
    async checkAndCreateTemplateFile() {
        try {
            const templatePath = this.settings.templatePath;
            if (!templatePath) {
                console.log('未设置模板文件路径，使用默认路径');
                this.settings.templatePath = '附件/drawio/空模板.svg';
                await this.saveSettings();
            }
            
            // 检查模板文件是否存在
            const templateFile = this.app.vault.getAbstractFileByPath(this.settings.templatePath);
            if (!templateFile) {
                console.log(`模板文件不存在: ${this.settings.templatePath}，准备创建`);
                
                // 确保模板文件目录存在
                const templateDir = path.dirname(this.settings.templatePath);
                if (templateDir) {
                    // 分解路径，以处理多层级目录
                    const pathParts = templateDir.split('/');
                    let currentPath = '';
                    
                    // 逐级检查和创建目录
                    for (const part of pathParts) {
                        currentPath = currentPath ? `${currentPath}/${part}` : part;
                        const folder = this.app.vault.getAbstractFileByPath(currentPath);
                        if (!folder) {
                            await this.app.vault.createFolder(currentPath);
                            console.log(`创建文件夹: ${currentPath}`);
                        }
                    }
                }
                
                // 创建一个基础的DrawIO SVG模板文件
                const templateContent = this.getDefaultDrawIOTemplate();
                await this.app.vault.create(this.settings.templatePath, templateContent);
                console.log(`✅ 已创建默认模板文件: ${this.settings.templatePath}`);
                new Notice(`已创建默认DrawIO模板文件: ${this.settings.templatePath}`, 5000);
            } else {
                console.log(`模板文件已存在: ${this.settings.templatePath}`);
            }
        } catch (error) {
            console.error(`检查/创建模板文件时出错: ${error.message}`);
            new Notice(`无法创建默认模板文件: ${error.message}`, 8000);
        }
    }

    // 获取默认的DrawIO模板内容
    getDefaultDrawIOTemplate() {
        // 这是一个基本的DrawIO SVG模板，包含必要的元数据和一个空白画布
        return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Do not edit this file with editors other than diagrams.net -->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="1px" height="1px" viewBox="-0.5 -0.5 1 1" content="&lt;mxfile host=&quot;app.diagrams.net&quot; modified=&quot;2023-01-01T00:00:00.000Z&quot; agent=&quot;Mozilla/5.0&quot; version=&quot;21.6.6&quot; etag=&quot;mVkYTxuIRU1nGDgnDcV9&quot;&gt;&lt;diagram id=&quot;ObsidianTemplate&quot; name=&quot;空白模板&quot;&gt;dZHBEoIgEIafhjtKU3Y2q0snD51JEJjQdRBH6+nTwIyxuLB8++/+sCCS1sPJ0Ka6AAcVxREfEDlEcbxPtn5O4OHANiEOSGO4Q9ECcvMEDkcs7QyHNhBaAGVNE8ICdA2FDRg1BvpQdgMVujZUwhfIC6q+6dVwW/E08c58BpNW3nkT8UlNvZiDtqIc+g9EskQSA2BdVA8JqGl2fi5Odzwxvh9moLY/BD5Y6h4vwQeS7AU=&lt;/diagram&gt;&lt;/mxfile&gt;">
<defs/>
<g/>
</svg>`;
    }
}

class DrawioCreatorSettingTab extends PluginSettingTab {
    plugin;

    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        let { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'DrawIO Creator 设置' });

        new Setting(containerEl)
            .setName('DrawIO 程序路径')
            .setDesc('设置DrawIO程序的完整路径')
            .addText(text => text
                .setPlaceholder('例如: E:\\Software\\Drawio\\draw.io\\draw.io.exe')
                .setValue(this.plugin.settings.drawioPath)
                .onChange(async (value) => {
                    this.plugin.settings.drawioPath = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('保存文件夹路径')
            .setDesc('设置DrawIO文件保存的文件夹路径（相对于库根目录）')
            .addText(text => text
                .setPlaceholder('例如: 附件/drawio')
                .setValue(this.plugin.settings.saveFolderPath)
                .onChange(async (value) => {
                    this.plugin.settings.saveFolderPath = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName('文件格式')
            .setDesc('选择保存的文件格式')
            .addDropdown(dropdown => dropdown
                .addOption('svg', 'SVG')
                .addOption('png', 'PNG')
                .setValue(this.plugin.settings.fileFormat)
                .onChange(async (value) => {
                    this.plugin.settings.fileFormat = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName('模板文件路径')
            .setDesc('设置DrawIO模板文件的路径（相对于库根目录）')
            .addText(text => text
                .setPlaceholder('例如: 附件/drawio/空模板.svg')
                .setValue(this.plugin.settings.templatePath)
                .onChange(async (value) => {
                    this.plugin.settings.templatePath = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName('图片宽度')
            .setDesc('设置插入Markdown时的图片默认宽度（像素）')
            .addText(text => text
                .setPlaceholder('例如: 500')
                .setValue(this.plugin.settings.imageWidth)
                .onChange(async (value) => {
                    this.plugin.settings.imageWidth = value;
                    await this.plugin.saveSettings();
                }));
    }
}

module.exports = DrawioCreatorPlugin;