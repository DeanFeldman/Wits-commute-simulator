#!/usr/bin/env python3
"""Automatic Wits Commute Sim trailer editor. Requires FFmpeg/FFprobe; no pip packages."""
from pathlib import Path
import json, math, random, shutil, struct, subprocess, sys, wave

OUT = Path("wits_commute_trailer.mp4")
W, H, FPS, SHOT = 1920, 1080, 30, 5.8
FONT = next((p for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf") if Path(p).exists()), None)

def run(cmd):
    subprocess.run(cmd, check=True)

def probe(path):
    data = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]))
    return float(data["format"]["duration"]), any(s["codec_type"] == "audio" for s in data["streams"])

def beat(path, seconds):
    rate, bpm, rng = 22050, 128, random.Random(17)
    roots = (55.0, 65.41, 49.0, 58.27)
    with wave.open(str(path), "wb") as w:
        w.setparams((1, 2, rate, 0, "NONE", "not compressed"))
        for sec in range(math.ceil(seconds)):
            b = bytearray()
            for i in range(rate):
                t = sec + i / rate
                if t >= seconds: break
                beatpos = t * bpm / 60
                q, eighth = beatpos % 1, (beatpos * 2) % 1
                root = roots[int(beatpos // 16) % 4]
                kick = .42 * math.sin(2 * math.pi * (105 - 48 * q) * q * 60 / bpm) * math.exp(-13 * q)
                snare = .23 * (rng.random() * 2 - 1) * math.exp(-24 * (beatpos % 2 - 1)) if beatpos % 2 >= 1 else 0
                hat = .09 * (rng.random() * 2 - 1) * math.exp(-42 * eighth)
                bass = .21 * math.sin(2 * math.pi * root * t) * max(.12, 1 - 1.5 * q)
                arp = .065 * math.sin(2 * math.pi * root * 4 * (1, 1.2, 1.5, 1.8)[int(beatpos * 2) % 4] * t) * math.exp(-5 * eighth)
                x = max(-.97, min(.97, kick + snare + hat + bass + arp))
                b.extend(struct.pack("<h", int(x * 32767)))
            w.writeframes(b)

if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
    sys.exit("Install FFmpeg first: sudo apt update && sudo apt install -y ffmpeg fonts-dejavu-core")
files = [Path(x) for x in sys.argv[1:]] or sorted(p for p in Path(".").glob("*.mp4") if p.name != OUT.name)
if len(files) > 2 and len(sys.argv) == 1: sys.exit("Multiple videos found. Pass gameplay filenames explicitly to avoid unrelated videos.")
files = files[:3]
if not files: sys.exit("Place your gameplay MP4s in this folder, or pass their paths as arguments.")
details = [probe(f) for f in files]
if any(d < 9 for d, _ in details): sys.exit("Each gameplay recording must be at least 9 seconds.")
if not FONT: sys.exit("Install a bold font: sudo apt install -y fonts-dejavu-core")
print("Using:", ", ".join(str(f) for f in files), flush=True)
filt, tracks, lengths = [], [], []

def esc(s):
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace("%", "\\%")

def add_card(head, sub, seconds):
    i = len(tracks)
    txt = f"fontfile={FONT}:fontcolor=white:x=(w-text_w)/2"
    vf = (f"color=c=0x0b1120:s={W}x{H}:r={FPS}:d={seconds},format=yuv420p,"
          f"drawbox=x=270:y=715:w=1380:h=7:color=0xfcc647:t=fill,"
          f"drawtext={txt}:text='{esc(head)}':fontsize=108:y=365,"
          f"drawtext={txt}:text='{esc(sub)}':fontsize=39:y=575,"
          f"fade=t=in:st=0:d=0.2,fade=t=out:st={seconds-.25}:d=0.25[v{i}]")
    filt.extend([vf, f"anullsrc=r=44100:cl=stereo,atrim=duration={seconds},asetpts=PTS-STARTPTS[a{i}]"])
    tracks.append(i); lengths.append(seconds)

def add_shot(fi, start, speed):
    i, dur = len(tracks), SHOT * speed
    base = (f"[{fi}:v:0]trim=start={start:.3f}:duration={dur:.3f},setpts=(PTS-STARTPTS)/{speed:.3f},"
            f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},"
            f"format=yuv420p,eq=contrast=1.06:saturation=1.08,"
            f"fade=t=in:st=0:d=0.12,fade=t=out:st={SHOT-.12}:d=0.12[v{i}]")
    if details[fi][1]:
        aud = (f"[{fi}:a:0]atrim=start={start:.3f}:duration={dur:.3f},asetpts=PTS-STARTPTS,"
               f"atempo={speed:.3f},aresample=44100,aformat=channel_layouts=stereo,"
               f"apad,atrim=duration={SHOT},asetpts=PTS-STARTPTS[a{i}]")
    else:
        aud = f"anullsrc=r=44100:cl=stereo,atrim=duration={SHOT},asetpts=PTS-STARTPTS[a{i}]"
    filt.extend([base, aud]); tracks.append(i); lengths.append(SHOT)

def chapter(path, index):
    name = path.stem.lower()
    if "level1" in name or "level-1" in name or "parking" in name: return "PARK."
    if "level2" in name or "level-2" in name or "cross" in name: return "CROSS."
    if "level3" in name or "level-3" in name or "cheat" in name: return "CHEAT."
    return ("THE COMMUTE", "THE CHAOS", "THE FINAL TEST")[index]

add_card("WITS COMMUTE SIM", "ONE STUDENT. ONE MORNING. THREE CHALLENGES.", 4.2)
nshots = {1: 12, 2: 7, 3: 5}[len(files)]
for fi, file in enumerate(files):
    add_card(chapter(file, fi), "REAL GAMEPLAY", 1.5)
    duration = details[fi][0]
    for j in range(nshots):
        speed = 1.18 if j >= nshots - 3 else 1.0
        span = SHOT * speed
        low = min(duration * .06, duration - span)
        high = max(low, duration - span - duration * .05)
        start = low + (high - low) * j / max(1, nshots - 1)
        add_shot(fi, start, speed)
add_card("PARK. CROSS. CHEAT.", "WITS COMMUTE SIM  |  GIT PUSH PRAY", 5.6)
total = sum(lengths)
if total > 119: sys.exit("Trailer would exceed the 2-minute limit.")
music = next((p for p in (Path("music.mp3"), Path("music.wav"), Path("music.m4a")) if p.exists()), None)
if music is None:
    music = Path("trailer_beat.wav")
    print("Generating original synthesized soundtrack...", flush=True)
    beat(music, total)
inputs = [arg for f in files for arg in ("-i", str(f))] + ["-stream_loop", "-1", "-i", str(music)]
chain = "".join(f"[v{i}][a{i}]" for i in tracks)
filt.extend([f"{chain}concat=n={len(tracks)}:v=1:a=1[vconcat][gameaudio]",
             "[gameaudio]volume=.40[game]",
             f"[{len(files)}:a:0]atrim=duration={total},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo,volume=.80[music]",
             f"[game][music]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=.93,"
             f"afade=t=in:st=0:d=0.5,afade=t=out:st={total-1.8}:d=1.8[outaudio]"])
print(f"Rendering {total:.1f}s trailer from {len(files)} recording(s)...", flush=True)
run(["ffmpeg", "-hide_banner", "-y", *inputs, "-filter_complex", ";".join(filt),
     "-map", "[vconcat]", "-map", "[outaudio]", "-t", str(total),
     "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
     "-pix_fmt", "yuv420p", "-r", str(FPS), "-c:a", "aac", "-b:a", "192k",
     "-movflags", "+faststart", str(OUT)])
print(f"FINISHED: {OUT.resolve()}")
