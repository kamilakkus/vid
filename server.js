const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/tmp/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

// Middleware
app.use(express.json());
app.use(express.static('/tmp/output'));
app.use(express.static('public')); // Serve static files from public directory

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir('/tmp/uploads', { recursive: true });
    await fs.mkdir('/tmp/output', { recursive: true });
    await fs.mkdir('/tmp/templates', { recursive: true });
  } catch (error) {
    console.log('Directory creation error:', error.message);
  }
}

// Web Interface - Serve main page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Video Processing Service</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f7fa;
        }
        .header {
            text-align: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .section {
            background: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .upload-area {
            border: 2px dashed #ddd;
            border-radius: 10px;
            padding: 30px;
            text-align: center;
            margin: 15px 0;
            transition: all 0.3s ease;
        }
        .upload-area:hover {
            border-color: #667eea;
            background: #f8f9ff;
        }
        .upload-area.dragover {
            border-color: #667eea;
            background: #f0f2ff;
        }
        input[type="file"] {
            margin: 10px 0;
        }
        button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s ease;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
        }
        .status {
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            display: none;
        }
        .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .template-status {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
        }
        .template-item {
            text-align: center;
            padding: 15px;
            border-radius: 8px;
            min-width: 150px;
        }
        .template-uploaded {
            background: #d4edda;
            color: #155724;
        }
        .template-missing {
            background: #f8d7da;
            color: #721c24;
        }
        .video-list {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 15px;
        }
        .video-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
            border-bottom: 1px solid #eee;
        }
        .video-item:last-child {
            border-bottom: none;
        }
        .download-btn {
            background: #28a745;
            color: white;
            text-decoration: none;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
        }
        .progress {
            width: 100%;
            height: 20px;
            background: #f0f0f0;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
            display: none;
        }
        .progress-bar {
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            width: 0%;
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎬 Video Processing Service</h1>
        <p>Upload intro & outro templates, then process videos via n8n</p>
    </div>

    <!-- Template Status -->
    <div class="section">
        <h2>📁 Template Status</h2>
        <div class="template-status">
            <div id="intro-status" class="template-item template-missing">
                <strong>Intro Template</strong><br>
                <span id="intro-text">Not uploaded</span>
            </div>
            <div id="outro-status" class="template-item template-missing">
                <strong>Outro Template</strong><br>
                <span id="outro-text">Not uploaded</span>
            </div>
        </div>
        <button onclick="checkTemplateStatus()">🔄 Refresh Status</button>
    </div>

    <!-- Upload Templates -->
    <div class="section">
        <h2>📤 Upload Templates</h2>
        
        <h3>Intro Video (with space for customer name)</h3>
        <div class="upload-area" id="intro-upload">
            <p>📽️ Drop intro video here or click to browse</p>
            <input type="file" id="intro-file" accept="video/*">
            <br>
            <button onclick="uploadTemplate('intro')" id="intro-btn">Upload Intro</button>
        </div>
        
        <h3>Outro Video</h3>
        <div class="upload-area" id="outro-upload">
            <p>🎬 Drop outro video here or click to browse</p>
            <input type="file" id="outro-file" accept="video/*">
            <br>
            <button onclick="uploadTemplate('outro')" id="outro-btn">Upload Outro</button>
        </div>
        
        <div class="progress" id="upload-progress">
            <div class="progress-bar" id="progress-bar"></div>
        </div>
        <div class="status" id="upload-status"></div>
    </div>

    <!-- API Information -->
    <div class="section">
        <h2>🔗 API Usage for n8n</h2>
        <p><strong>Process Video Endpoint:</strong></p>
        <code style="background: #f8f9fa; padding: 10px; border-radius: 5px; display: block; margin: 10px 0;">
            POST ${window.location.origin}/process-video<br>
            Form-data: customer_name=John Smith, main_video=[file]
        </code>
        <p><strong>Response:</strong> Returns download URL for processed video</p>
    </div>

    <!-- Processed Videos -->
    <div class="section">
        <h2>📹 Processed Videos</h2>
        <button onclick="loadVideos()">🔄 Refresh List</button>
        <div id="video-list" class="video-list">
            <p>Click refresh to load videos...</p>
        </div>
    </div>

    <script>
        // Check template status on load
        window.onload = function() {
            checkTemplateStatus();
            loadVideos();
        };

        // Drag and drop functionality
        ['intro-upload', 'outro-upload'].forEach(id => {
            const area = document.getElementById(id);
            const fileInput = document.getElementById(id.replace('-upload', '-file'));
            
            area.onclick = () => fileInput.click();
            
            area.ondragover = (e) => {
                e.preventDefault();
                area.classList.add('dragover');
            };
            
            area.ondragleave = () => {
                area.classList.remove('dragover');
            };
            
            area.ondrop = (e) => {
                e.preventDefault();
                area.classList.remove('dragover');
                fileInput.files = e.dataTransfer.files;
            };
        });

        async function checkTemplateStatus() {
            try {
                const response = await fetch('/template-status');
                const status = await response.json();
                
                updateTemplateUI('intro', status.intro);
                updateTemplateUI('outro', status.outro);
            } catch (error) {
                console.error('Error checking status:', error);
            }
        }

        function updateTemplateUI(type, exists) {
            const statusDiv = document.getElementById(type + '-status');
            const textSpan = document.getElementById(type + '-text');
            
            if (exists) {
                statusDiv.className = 'template-item template-uploaded';
                textSpan.textContent = 'Uploaded ✅';
            } else {
                statusDiv.className = 'template-item template-missing';
                textSpan.textContent = 'Not uploaded ❌';
            }
        }

        async function uploadTemplate(type) {
            const fileInput = document.getElementById(type + '-file');
            const button = document.getElementById(type + '-btn');
            const statusDiv = document.getElementById('upload-status');
            const progressDiv = document.getElementById('upload-progress');
            const progressBar = document.getElementById('progress-bar');
            
            if (!fileInput.files[0]) {
                showStatus('Please select a file first', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('video', fileInput.files[0]);

            button.disabled = true;
            button.textContent = 'Uploading...';
            progressDiv.style.display = 'block';
            progressBar.style.width = '0%';

            try {
                const xhr = new XMLHttpRequest();
                
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = (e.loaded / e.total) * 100;
                        progressBar.style.width = percent + '%';
                    }
                };

                xhr.onload = () => {
                    if (xhr.status === 200) {
                        const result = JSON.parse(xhr.responseText);
                        showStatus(result.message, 'success');
                        checkTemplateStatus();
                        fileInput.value = '';
                    } else {
                        showStatus('Upload failed: ' + xhr.statusText, 'error');
                    }
                    button.disabled = false;
                    button.textContent = 'Upload ' + type.charAt(0).toUpperCase() + type.slice(1);
                    progressDiv.style.display = 'none';
                };

                xhr.onerror = () => {
                    showStatus('Upload failed: Network error', 'error');
                    button.disabled = false;
                    button.textContent = 'Upload ' + type.charAt(0).toUpperCase() + type.slice(1);
                    progressDiv.style.display = 'none';
                };

                xhr.open('POST', '/upload-template/' + type);
                xhr.send(formData);

            } catch (error) {
                showStatus('Upload failed: ' + error.message, 'error');
                button.disabled = false;
                button.textContent = 'Upload ' + type.charAt(0).toUpperCase() + type.slice(1);
                progressDiv.style.display = 'none';
            }
        }

        async function loadVideos() {
            try {
                const response = await fetch('/videos');
                const data = await response.json();
                
                const videoList = document.getElementById('video-list');
                
                if (data.videos.length === 0) {
                    videoList.innerHTML = '<p>No processed videos found</p>';
                    return;
                }

                videoList.innerHTML = data.videos.map(video => \`
                    <div class="video-item">
                        <span>\${video}</span>
                        <a href="/download/\${video}" class="download-btn" download>📥 Download</a>
                    </div>
                \`).join('');
                
            } catch (error) {
                document.getElementById('video-list').innerHTML = '<p>Error loading videos: ' + error.message + '</p>';
            }
        }

        function showStatus(message, type) {
            const statusDiv = document.getElementById('upload-status');
            statusDiv.textContent = message;
            statusDiv.className = 'status ' + type;
            statusDiv.style.display = 'block';
            
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    </script>
</body>
</html>
  `);
});

// Check template status endpoint
app.get('/template-status', async (req, res) => {
  try {
    const introExists = await fs.access('/tmp/templates/intro.mp4').then(() => true).catch(() => false);
    const outroExists = await fs.access('/tmp/templates/outro.mp4').then(() => true).catch(() => false);
    
    res.json({
      intro: introExists,
      outro: outroExists
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Upload template videos (intro/outro)
app.post('/upload-template/:type', upload.single('video'), async (req, res) => {
  try {
    const { type } = req.params; // 'intro' or 'outro'
    
    if (!['intro', 'outro'].includes(type)) {
      return res.status(400).json({ error: 'Invalid template type' });
    }

    const templatePath = `/tmp/templates/${type}.mp4`;
    await fs.copyFile(req.file.path, templatePath);
    
    // Clean up uploaded file
    await fs.unlink(req.file.path);

    res.json({ 
      success: true, 
      message: `${type} template uploaded successfully`,
      path: templatePath 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process video: intro + customer_name + main_video + outro
app.post('/process-video', upload.single('main_video'), async (req, res) => {
  const startTime = Date.now();
  const jobId = `job_${startTime}`;
  
  try {
    const { customer_name } = req.body;
    
    if (!customer_name) {
      return res.status(400).json({ error: 'customer_name is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'main_video file is required' });
    }

    // File paths
    const mainVideoPath = req.file.path;
    const introTemplatePath = '/tmp/templates/intro.mp4';
    const outroTemplatePath = '/tmp/templates/outro.mp4';
    const introWithNamePath = `/tmp/output/${jobId}_intro_with_name.mp4`;
    const finalOutputPath = `/tmp/output/${jobId}_final.mp4`;
    const concatListPath = `/tmp/output/${jobId}_concat.txt`;

    // Check if template files exist
    try {
      await fs.access(introTemplatePath);
      await fs.access(outroTemplatePath);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Template files not found. Please upload intro and outro videos first.' 
      });
    }

    // Step 1: Add customer name to intro video
    const addTextCommand = `ffmpeg -i "${introTemplatePath}" -vf "drawtext=text='${customer_name}':x=(w-text_w)/2:y=(h-text_h)/2+100:fontsize=48:fontcolor=white:box=1:boxcolor=black@0.5" -c:a copy "${introWithNamePath}"`;

    await new Promise((resolve, reject) => {
      exec(addTextCommand, (error, stdout, stderr) => {
        if (error) {
          console.error('FFmpeg text overlay error:', error);
          reject(error);
        } else {
          resolve();
        }
      });
    });

    // Step 2: Create concatenation list
    const concatList = [
      `file '${introWithNamePath}'`,
      `file '${mainVideoPath}'`,
      `file '${outroTemplatePath}'`
    ].join('\n');

    await fs.writeFile(concatListPath, concatList);

    // Step 3: Concatenate videos
    const concatCommand = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy "${finalOutputPath}"`;

    await new Promise((resolve, reject) => {
      exec(concatCommand, (error, stdout, stderr) => {
        if (error) {
          console.error('FFmpeg concatenation error:', error);
          reject(error);
        } else {
          resolve();
        }
      });
    });

    // Clean up temporary files
    try {
      await fs.unlink(mainVideoPath);
      await fs.unlink(introWithNamePath);
      await fs.unlink(concatListPath);
    } catch (cleanupError) {
      console.log('Cleanup warning:', cleanupError.message);
    }

    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      job_id: jobId,
      customer_name: customer_name,
      output_url: `/${jobId}_final.mp4`,
      processing_time_ms: processingTime,
      message: 'Video processed successfully'
    });

  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ 
      error: 'Video processing failed', 
      details: error.message,
      job_id: jobId
    });
  }
});

// Get processed video
app.get('/download/:filename', (req, res) => {
  const filePath = path.join('/tmp/output', req.params.filename);
  res.download(filePath, (error) => {
    if (error) {
      res.status(404).json({ error: 'File not found' });
    }
  });
});

// List available videos
app.get('/videos', async (req, res) => {
  try {
    const files = await fs.readdir('/tmp/output');
    const videoFiles = files.filter(f => f.endsWith('.mp4'));
    res.json({ videos: videoFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;

// Initialize and start server
async function start() {
  await ensureDirectories();
  
  app.listen(PORT, () => {
    console.log(`Video processing service running on port ${PORT}`);
    console.log('Endpoints:');
    console.log('  POST /upload-template/intro - Upload intro template');
    console.log('  POST /upload-template/outro - Upload outro template'); 
    console.log('  POST /process-video - Process video with customer name');
    console.log('  GET /videos - List processed videos');
    console.log('  GET /download/:filename - Download video');
  });
}

start().catch(console.error);