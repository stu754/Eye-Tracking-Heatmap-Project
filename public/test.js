let imgList = [], curIdx = 0, isPaused = false;
let gazeData = [], saveTimer = null;
const saveIntervalMs = 10000; // 你可以调整保存频率
const CALIBRATION_CLICKS = 1; // 校准点击次数

let CalibrationPoints = {}, PointCalibrate = 0;

// DOM 元素
const overlay        = document.getElementById('overlay');
const calibrationDiv = document.querySelector('.calibrationDiv');
const plottingCanvas = document.getElementById('plotting_canvas');
const testMain       = document.getElementById('testMain');
const startTestBtn   = document.getElementById('startTestBtn');
const testImg        = document.getElementById('testImg');
const prevBtn        = document.getElementById('prevBtn');
const nextBtn        = document.getElementById('nextBtn');
const pauseBtn       = document.getElementById('pauseBtn');
const stopBtn        = document.getElementById('stopBtn');

// ========== 校准逻辑 ==========
function showCalibrationPoints() {
  overlay.style.display        = 'none';
  calibrationDiv.style.display = 'block';
  plottingCanvas.style.display = 'block';
  document.querySelectorAll('.calib-dot').forEach(dot => {
    dot.style.display         = 'block';
    dot.style.backgroundColor = 'red';
    dot.style.opacity         = '0.2';
    dot.disabled              = false;
  });
  document.getElementById('Pt5').style.display = 'none';
  CalibrationPoints = {};
  PointCalibrate    = 0;
}

function calPointClick(dot) {
  const id = dot.id;
  CalibrationPoints[id] = (CalibrationPoints[id] || 0) + 1;
  const count = CalibrationPoints[id];
  if (count === CALIBRATION_CLICKS) {
    dot.style.backgroundColor = 'yellow';
    dot.disabled              = true;
    PointCalibrate++;
  } else {
    dot.style.opacity = String(0.2 * count + 0.2);
  }
  if (PointCalibrate === 8) {
    document.getElementById('Pt5').style.display = 'block';
  }
  if (PointCalibrate >= 9) {
    finishCalibration();
  }
}

function finishCalibration() {
    // 1. 先弹窗，不隐藏校正版面
    swal({
      title: "校准完成",
      text: "请保持坐姿稳定，准备进入正式测试环节！",
      icon: "success",
      button: "进入测试"
    }).then(() => {
      // 2. 用户点了“进入测试”后，再隐藏校正版面/画布
      calibrationDiv.style.display = 'none';
      plottingCanvas.style.display = 'none';

      // 然后才显示测试页面等后续操作
      testMain.style.display = 'flex';
      showImage(curIdx);
      setBtnStatus(true);
      resetGazeData();
      startGazeListener();
      startSaveTimer();
    });
}
// ========== gaze采集&保存 ==========
function resetGazeData() {
  gazeData = [];
}

function startGazeListener() {
  if (!window.webgazer) return;
  webgazer.setGazeListener(function(data, elapsedTime) {
    if (!data) return;
    if (!isPaused) {
      const rect = testImg.getBoundingClientRect();
      gazeData.push({
        x: data.x,
        y: data.y,
        t: Date.now(),
        img: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        }
      });
    }
  }).begin();
}

function startSaveTimer() {
  if (saveTimer) clearInterval(saveTimer);
  saveTimer = setInterval(() => {
    if (gazeData.length > 0) saveGaze();
  }, saveIntervalMs);
}

function stopSaveTimer() {
  if (saveTimer) clearInterval(saveTimer);
  saveTimer = null;
}

async function saveGaze() {
  if (!imgList[curIdx] || gazeData.length === 0) return;
  const imgName = imgList[curIdx].filename.replace(/\.[^/.]+$/, "");
  const dataToSave = gazeData.slice();
  gazeData = [];
  await fetch('/api/save-gaze', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ imgId: imgName, gazeData: dataToSave })
  });
}

async function saveFinalGaze() {
  if (!imgList[curIdx]) return;
  if (gazeData.length > 0) await saveGaze();
}

// ========== 测试流程&按钮 ==========
function setBtnStatus(enable) {
  prevBtn.disabled  = !enable || curIdx === 0;
  nextBtn.disabled  = !enable || curIdx === imgList.length - 1;
  pauseBtn.disabled = !enable;
  stopBtn.disabled  = !enable;
}

async function gotoImage(idx) {
  await saveFinalGaze();
  curIdx = idx;
  showImage(curIdx);
  setBtnStatus(true);
  resetGazeData();
}

async function endTest() {
  stopSaveTimer();
  await saveFinalGaze();
  swal({
    title: "测试已结束",
    text: "感谢您的参与！",
    icon: "success",
    button: "确定"
  }).then(() => {
    window.location.reload();
  });
}

async function interruptTest() {
  stopSaveTimer();
  await saveFinalGaze();
  swal({
    title: "测试中断",
    text: "当前进度已保存。",
    icon: "warning",
    button: "确定"
  });
}

async function fetchImages() {
  const res = await fetch('/api/test-images');
  imgList = await res.json();
  if (!Array.isArray(imgList) || imgList.length === 0) {
    swal("错误", "找不到测试图片", "error");
    return false;
  }
  return true;
}

function showImage(idx) {
  testImg.style.display = 'none';
  testImg.onload        = () => { testImg.style.display = 'block'; };
  testImg.src           = `/test_imgs/${imgList[idx].filename}`;
}

// ========== 初始化&事件绑定 ==========
startTestBtn.onclick = async () => {
  overlay.style.display        = 'none';
  testMain.style.display       = 'none';
  if (!await fetchImages()) return;
  curIdx = 0;
  resetGazeData();
  window.webgazer.setRegression('ridge').setGazeListener(() => {}).begin();
  showCalibrationPoints();
};

document.addEventListener('DOMContentLoaded', () => {
  testMain.style.display       = 'none';
  calibrationDiv.style.display = 'none';
  plottingCanvas.style.display = 'none';
  overlay.style.display        = 'flex';
  fetchImages().then(() => setBtnStatus(false));

  // 导航栏跳转中断
  document.querySelectorAll('.navbar a').forEach(a => {
    a.addEventListener('click', async e => {
      if (testMain.style.display !== 'none') {
        e.preventDefault();
        await interruptTest();
        window.location.href = a.href;
      }
    });
  });

  // 校准点点击
  document.querySelectorAll('.calib-dot').forEach(dot => {
    dot.addEventListener('click', () => calPointClick(dot));
  });
});

// 按钮功能
prevBtn.onclick  = async () => { stopSaveTimer(); await gotoImage(curIdx - 1); startSaveTimer(); };
nextBtn.onclick  = async () => { stopSaveTimer(); await gotoImage(curIdx + 1); startSaveTimer(); };
pauseBtn.onclick = () => {
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? '继续测试' : '暂停测试';
  isPaused ? stopSaveTimer() : startSaveTimer();
};
stopBtn.onclick  = () => endTest();
