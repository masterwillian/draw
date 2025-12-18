const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        frame: true,
        backgroundColor: '#121212',
        show: false
    });

    mainWindow.loadFile('index.html');

    // Show when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Custom menu
const menuTemplate = [
    {
        label: 'Arquivo',
        submenu: [
            {
                label: 'Salvar Imagem',
                accelerator: 'CmdOrCtrl+S',
                click: () => {
                    mainWindow.webContents.executeJavaScript('saveCanvas()');
                }
            },
            { type: 'separator' },
            {
                label: 'Sair',
                accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
                click: () => app.quit()
            }
        ]
    },
    {
        label: 'Editar',
        submenu: [
            {
                label: 'Desfazer',
                accelerator: 'CmdOrCtrl+Z',
                click: () => {
                    mainWindow.webContents.executeJavaScript('undo()');
                }
            },
            {
                label: 'Refazer',
                accelerator: 'CmdOrCtrl+Y',
                click: () => {
                    mainWindow.webContents.executeJavaScript('redo()');
                }
            },
            { type: 'separator' },
            {
                label: 'Limpar Tudo',
                click: () => {
                    mainWindow.webContents.executeJavaScript('if(confirm("Limpar todo o canvas?")) { strokes = []; redraw(); }');
                }
            }
        ]
    },
    {
        label: 'Ver',
        submenu: [
            {
                label: 'Zoom In',
                accelerator: 'CmdOrCtrl+Plus',
                click: () => {
                    mainWindow.webContents.executeJavaScript('adjustZoom(0.1)');
                }
            },
            {
                label: 'Zoom Out',
                accelerator: 'CmdOrCtrl+-',
                click: () => {
                    mainWindow.webContents.executeJavaScript('adjustZoom(-0.1)');
                }
            },
            {
                label: 'Reset Zoom',
                accelerator: 'CmdOrCtrl+0',
                click: () => {
                    mainWindow.webContents.executeJavaScript('cameraZoom = 1; cameraOffset = {x: 0, y: 0}; redraw();');
                }
            },
            { type: 'separator' },
            {
                label: 'Tela Cheia',
                accelerator: 'F11',
                click: () => {
                    mainWindow.setFullScreen(!mainWindow.isFullScreen());
                }
            },
            { type: 'separator' },
            {
                label: 'DevTools',
                accelerator: 'F12',
                click: () => {
                    mainWindow.webContents.toggleDevTools();
                }
            }
        ]
    },
    {
        label: 'Ajuda',
        submenu: [
            {
                label: 'Sobre',
                click: () => {
                    const { dialog } = require('electron');
                    dialog.showMessageBox(mainWindow, {
                        type: 'info',
                        title: 'Sobre Drawly',
                        message: 'Drawly v1.0.0',
                        detail: 'Ferramenta de desenho intuitiva e moderna.\n\nFeito por @masterwillian'
                    });
                }
            },
            {
                label: 'GitHub',
                click: () => {
                    shell.openExternal('https://github.com/masterwillian/draw');
                }
            }
        ]
    }
];

app.whenReady().then(() => {
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
