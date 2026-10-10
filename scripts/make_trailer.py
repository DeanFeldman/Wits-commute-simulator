#!/usr/bin/env python3
"""Wits Commute Sim trailer: memory-safe, sequential FFmpeg rendering. No pip dependencies."""
from pathlib import Path
import json, math, os, random, shutil, struct, subprocess, sys, tempfile, wave

OUT = Path("wits_commute_trailer.mp4").resolve()
FPS, SHOT = 30, 5.8
W, H = (1920, 1080) if "--1080p" in sys.argv else (1280, 720)
FONT = next((x for x in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf") if Path(x).exists()), None)

def run(args):
    subprocess.run(args, check=True)

def probe(path):
    data = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]))
    return float(data["format"]["duration"]), any(x["codec_type"] == "audio" for x in data["streams"])

def audio_beat(path, seconds):
    sr, bpm, rng = 22050, 128, random.Random(17)
    roots = (55.0, 65.41, 49.0, 58.27)
    with wave.open(str(path), "wb") as wav:
        wav.setparams((1, 2, sr, 0, "NONE", "not compressed"))
        for second in range(math.ceil(seconds)):
            frames = bytearray()
            for i in range(sr):
                t = second + i / sr
                if t >= seconds: break
                beat = t * bpm / 60
                phase, hat = beat % 1, (beat * 2) % 1
                bass = .22 * math.sin(2 * math.pi * roots[int(beat // 16) % 4] * t) * max(.12, 1 - 1.5 * phase)
                kick = .40 * math.sin(2 * math.pi * (105 - 48 * phase) * phase * 60 / bpm) * math.exp(-13 * phase)
                hiss = .08 * (rng.random() * 2 - 1) * math.exp(-42 * hat)
                val = max(-.95, min(.95, bass + kick + hiss))
                frames += struct.pack("<h", int(val * 32767))
            wav.writeframes(frames)

def esc(s):
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace("%", "\\%")

def encode(inputs, vf, af, dur, dest, video_input=0, audio_input=0):
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-stats", "-y", *inputs,
           "-map", f"{video_input}:v:0", "-map", f"{audio_input}:a:0",
           "-vf", vf, "-af", af, "-t", str(dur), "-r", str(FPS),
           "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "23",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "44100", "-ac", "2",
           "-b:a", "128k", "-movflags", "+faststart", str(dest)]
    run(cmd)

def card(path, title, subtitle, duration):
    font = f"fontfile={FONT}:fontcolor=white:x=(w-text_w)/2"
    vf = (f"drawbox=x=0:y=0:w=iw:h=ih:color=0x0b1120:t=fill,"
          f"drawbox=x=iw*0.15:y=ih*0.67:w=iw*0.7:h=5:color=0xfcc647:t=fill,"
          f"drawtext={font}:text='{esc(title)}':fontsize={int(W*.057)}:y=h*0.34,"
          f"drawtext={font}:text='{esc(subtitle)}':fontsize={int(W*.021)}:y=h*0.54,"
          f"fade=t=in:st=0:d=0.2,fade=t=out:st={duration-0.25:.2f}:d=0.25")
    encode(["-f", "lavfi", "-i", f"color=c=0x0b1120:s={W}x{H}:r={FPS}:d={duration}",
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"],
           vf, "anull", duration, path, 0, 1)

def shot(path, info, start, speed, dest):
    duration, has_audio = info
    span = SHOT * speed
    start = max(0, min(start, duration - span))
    inputs = ["-ss", f"{start:.3f}", "-t", f"{span:.3f}", "-i", str(path)]
    ai = 0
    if not has_audio:
        inputs += ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]
        ai = 1
    vf = (f"setpts=(PTS-STARTPTS)/{speed:.3f},"
          f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
          f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,fps={FPS},format=yuv420p,"
          f"eq=contrast=1.05:saturation=1.08,"
          f"fade=t=in:st=0:d=0.12,fade=t=out:st={SHOT-0.12:.2f}:d=0.12")
    af = (f"atempo={speed:.3f},aresample=44100,aformat=channel_layouts=stereo,"
          f"afade=t=in:st=0:d=0.12,afade=t=out:st={SHOT-0.12:.2f}:d=0.12")
    encode(inputs, vf, af, SHOT, dest, 0, ai)

def main():
    for binary in ("ffmpeg", "ffprobe"):
        if not shutil.which(binary): sys.exit("Install FFmpeg: sudo apt install -y ffmpeg fonts-dejavu-core")
    if not FONT: sys.exit("Install fonts: sudo apt install -y fonts-dejavu-core")
    args = [a for a in sys.argv[1:] if a != "--1080p"]
    files = [Path(a) for a in args] if args else sorted(x for x in Path(".").glob("*.mp4") if x.resolve() != OUT)
    if not files or len(files) > 3: sys.exit("Pass 1–3 gameplay MP4 paths explicitly, e.g. python3 make_trailer.py 'clip 1.mp4' 'clip 2.mp4'")
    if len(files) > 2 and not args: sys.exit("Multiple MP4 files found: specify the gameplay recordings explicitly.")
    for f in files:
        if not f.is_file(): sys.exit(f"Missing gameplay recording: {f}")
    infos = [probe(f) for f in files]
    if any(d < SHOT * 1.18 + 1 for d, _ in infos): sys.exit("One gameplay clip is too short (needs 8+ seconds).")
    n = {1:12, 2:7, 3:5}[len(files)]
    total = 4.2 + len(files) * (1.5 + n * SHOT) + 5.6
    if total >= 120: sys.exit("Trailer would exceed the 2-minute limit.")
    print(f"Editing {len(files)} recordings into {total:.1f}s {W}x{H} trailer.", flush=True)
    with tempfile.TemporaryDirectory(prefix="wits-trailer-") as tmp:
        work = Path(tmp)
        parts = []
        def render(kind, *args):
            dest = work / f"{len(parts):03d}.mp4"
            print(f"Rendering section {len(parts)+1}/{len(files)*(n+1)+2}...", flush=True)
            (card if kind == "card" else shot)(dest, *args)
            parts.append(dest)
        render("card", "WITS COMMUTE SIM", "ONE STUDENT. ONE MORNING. THREE CHALLENGES.", 4.2)
        names = ["THE COMMUTE", "THE CHAOS", "THE FINAL TEST"]
        for idx, (src, inf) in enumerate(zip(files, infos)):
            name = src.stem.lower()
            title = "PARK." if "parking" in name or "level1" in name else "CROSS." if "cross" in name or "level2" in name else "CHEAT." if "cheat" in name or "level3" in name else names[idx]
            render("card", title, "REAL GAMEPLAY", 1.5)
            d = inf[0]
            for j in range(n):
                speed = 1.18 if j >= n - 3 else 1.0
                span = SHOT * speed
                start = d * .06 + max(0, d * .89 - span) * j / max(1, n - 1)
                render("shot", src, inf, start, speed)
        render("card", "PARK. CROSS. CHEAT.", "WITS COMMUTE SIM  -  GIT PUSH PRAY", 5.6)
        manifest = work / "segments.txt"
        manifest.write_text("".join(f"file '{p.name}'\n" for p in parts))
        joined = work / "joined.mp4"
        print("Joining sections (no re-encoding)...", flush=True)
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(manifest), "-c", "copy", str(joined)])
        music = next((p for p in (Path("music.mp3"), Path("music.wav"), Path("music.m4a")) if p.exists()), None)
        if music is None:
            music = work / "trailer_beat.wav"
            print("Creating original soundtrack...", flush=True)
            audio_beat(music, total)
        finished = work / OUT.name
        print("Mixing music and finalising MP4...", flush=True)
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(joined), "-stream_loop", "-1", "-i", str(music),
             "-filter_complex", f"[0:a]volume=0.42[game];[1:a]volume=0.75,afade=t=out:st={total-1.8:.2f}:d=1.8[music];[game][music]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.93[a]",
             "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
             "-t", str(total), "-movflags", "+faststart", str(finished)])
        d, _ = probe(finished)
        if d < total - 1: sys.exit(f"Trailer validation failed: output only {d:.1f}s")
        os.replace(finished, OUT)
    print(f"FINISHED: {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)", flush=True)

if __name__ == "__main__":
    main()
