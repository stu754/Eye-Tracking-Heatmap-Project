const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

// Windows 下 venv 路径
const pythonPath = path.join(__dirname, 'result', 'venv', 'Scripts', 'python.exe');
// 如为 Mac/Linux，改成：
// const pythonPath = path.join(__dirname, 'result', 'venv', 'bin', 'python');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/test_imgs', express.static(path.join(__dirname, 'public', 'test_imgs')));
app.use(bodyParser.json({limit: '10mb'}));

// 热力图静态资源暴露
app.use('/result/heatmap', express.static(path.join(__dirname, 'result', 'heatmap')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/test', (req, res) => res.sendFile(path.join(__dirname, 'views', 'test.html')));
app.get('/result', (req, res) => res.sendFile(path.join(__dirname, 'views', 'result.html')));
app.get('/more', (req, res) => res.sendFile(path.join(__dirname, 'views', 'more.html')));

// 获取所有测试图片文件名
app.get('/api/test-images', (req, res) => {
    const imgDir = path.join(__dirname, 'public', 'test_imgs');
    fs.readdir(imgDir, (err, files) => {
        if (err) return res.status(500).json({error: '读取图片目录失败'});
        const imgList = files
            .filter(name => /^\d+\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(name))
            .map(name => ({
                id: parseInt(name.split('.')[0]),
                filename: name
            }))
            .sort((a, b) => a.id - b.id);
        res.json(imgList);
    });
});

// 保存注视数据
app.post('/api/save-gaze', (req, res) => {
    const {imgId, gazeData} = req.body;
    if (!imgId || !Array.isArray(gazeData)) {
        return res.status(400).json({error: '参数不正确'});
    }
    const saveDir = path.join(__dirname, 'result', 'data');
    if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, {recursive: true});
    const filePath = path.join(saveDir, `${imgId}.json`);
    fs.writeFile(filePath, JSON.stringify(gazeData, null, 2), err => {
        if (err) {
            return res.status(500).json({error: '保存失败'});
        }
        res.json({success: true});
    });
});

// 终止测试时自动生成热力图（用 venv 环境）
app.post('/api/finish-test', (req, res) => {
    const pyProcess = spawn(pythonPath, ['process.py'], { cwd: path.join(__dirname, 'result') });
    let stdout = '', stderr = '';
    pyProcess.stdout.on('data', data => { stdout += data.toString(); });
    pyProcess.stderr.on('data', data => { stderr += data.toString(); });
    pyProcess.on('close', code => {
        if (code !== 0) {
            console.error('Python 脚本执行失败:', stderr);
            res.status(500).json({error: 'Python 处理失败', detail: stderr});
        } else {
            console.log('Python 脚本输出:', stdout);
            res.json({success: true, msg: stdout});
        }
    });
});

// 中断测试时也自动生成热力图（同样用 venv 环境）
app.post('/api/interrupt-test', (req, res) => {
    const pyProcess = spawn(pythonPath, ['process.py'], { cwd: path.join(__dirname, 'result') });
    let stdout = '', stderr = '';
    pyProcess.stdout.on('data', data => { stdout += data.toString(); });
    pyProcess.stderr.on('data', data => { stderr += data.toString(); });
    pyProcess.on('close', code => {
        if (code !== 0) {
            console.error('Python 脚本执行失败:', stderr);
            res.status(500).json({error: 'Python 处理失败', detail: stderr});
        } else {
            console.log('Python 脚本输出:', stdout);
            res.json({success: true, msg: stdout});
        }
    });
});

// 热力图文件列表API
app.get('/api/heatmaps', (req, res) => {
    const dir = path.join(__dirname, 'result', 'heatmap');
    fs.readdir(dir, (err, files) => {
        if (err) return res.status(500).json({error: '读取热力图目录失败'});
        const list = files.filter(name => /\.(png|jpg|jpeg)$/i.test(name));
        res.json(list);
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
