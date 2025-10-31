# 3D Title Export Tool

This page displays just the animated 3D "EX Research" title on a transparent background, optimized for recording and exporting as a looping GIF.

## 🎬 How to Record

### Option 1: Screen Recording (Recommended)

#### **macOS - QuickTime Player**
1. Open QuickTime Player
2. File → New Screen Recording
3. Click the dropdown arrow next to the record button
4. Select "Built-in Microphone: None" (no audio needed)
5. Click Record, then drag to select just the title area
6. Record for 4-5 seconds to capture a full animation loop
7. Stop recording (menu bar icon)
8. File → Export As → 1080p or 4K

#### **Windows - ScreenToGif (Free)**
1. Download from https://www.screentogif.com/
2. Launch and select "Recorder"
3. Position the recording frame over the title
4. Click Record, wait 4-5 seconds
5. Click Stop
6. Edit and export directly as GIF with transparency support

#### **Cross-platform - OBS Studio (Free)**
1. Download from https://obsproject.com/
2. Add "Window Capture" or "Display Capture" source
3. Crop to just the title area
4. Start Recording
5. Record for 4-5 seconds
6. Stop Recording
7. Convert the video file to GIF (see below)

### Option 2: Browser Extensions

#### **Chrome/Edge - Screen Recorder**
1. Install "Screen Recorder" extension
2. Click extension icon
3. Choose "Current Tab"
4. Start recording
5. Wait 4-5 seconds
6. Stop and download

## 🎨 Converting to GIF with Transparency

### Method 1: ezgif.com (Easiest)
1. Go to https://ezgif.com/video-to-gif
2. Upload your video file
3. Click "Convert to GIF"
4. On the result page, click "Effects"
5. Select "Make transparent" and choose the background color (the gray checkerboard)
6. Download your transparent GIF

### Method 2: Photoshop
1. File → Import → Video Frames to Layers
2. Select your video file
3. Choose "From Beginning to End" or "Selected Range Only"
4. Click OK
5. Delete the background layer (checkerboard)
6. File → Export → Save for Web (Legacy)
7. Choose GIF format
8. Check "Transparency"
9. Set looping to "Forever"
10. Save

### Method 3: GIMP (Free)
1. File → Open as Layers
2. Select your video frames (or import video)
3. Use "Color to Alpha" to remove background
4. Filters → Animation → Optimize (for GIF)
5. File → Export As → Choose GIF
6. Check "As Animation" and "Loop Forever"
7. Export

### Method 4: FFmpeg + Gifski (Command Line)
```bash
# Extract frames from video
ffmpeg -i input.mov -vf "fps=30" frame%04d.png

# Create GIF with transparency (if needed, use imagemagick to make bg transparent first)
gifski -o output.gif frame*.png --fps 30

# Or use FFmpeg directly
ffmpeg -i input.mov -vf "fps=30,scale=800:-1:flags=lanczos" -c:v gif output.gif
```

## 📐 Specifications

- **Canvas Size:** 800px × 300px
- **Recommended Recording Duration:** 4-5 seconds
- **Animation Loop:** Seamless (repeats perfectly)
- **Background:** Transparent (checkerboard is visual guide only)
- **Format:** HTML5/WebGL (Three.js)

## 💡 Tips for Best Results

1. **Smooth Loop:** Record for exactly one complete animation cycle (about 4 seconds) for a perfect loop
2. **High Quality:** Use the highest resolution/quality settings your recording tool offers
3. **Frame Rate:** 30 FPS is ideal for smooth animation
4. **File Size:** If GIF is too large, reduce dimensions or frame count
5. **Test Loop:** Before finalizing, test that your GIF loops smoothly
6. **Colors:** The title uses gold (EX) and hot pink (Research) colors

## 🎯 Quick Start

1. Open `index.html` in a modern browser (Chrome, Firefox, Safari, Edge)
2. Position your screen recording tool over the animated title
3. Record for 4-5 seconds
4. Convert to GIF with transparency using one of the methods above
5. Done! You now have a looping transparent GIF of the 3D title

## 🔧 Customization

If you want to modify the animation, colors, or size, edit the `index.html` file:

- **Canvas size:** Change `w` and `h` variables in the `init()` function
- **Colors:** Modify the `color` and `emissive` properties in the materials
- **Animation speed:** Adjust the multipliers in the `render()` function
- **Camera angle:** Change `titleCamera.position.set()` values

## 📦 No Installation Required

This page uses CDN-hosted Three.js library, so no npm install or build process needed. Just open the HTML file in a browser!

