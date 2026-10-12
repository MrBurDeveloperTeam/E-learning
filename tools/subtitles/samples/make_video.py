"""Create a local video fixture with the JFK sample as its soundtrack."""
from pathlib import Path
import av
import numpy as np

folder = Path(__file__).resolve().parent
with av.open(str(folder / 'jfk.wav')) as source, av.open(str(folder / 'jfk.mp4'), 'w') as output:
    video = output.add_stream('mpeg4', rate=1)
    video.width, video.height, video.pix_fmt = 320, 180, 'yuv420p'
    audio = output.add_stream('aac', rate=16000)
    audio.layout = 'mono'
    for i in range(11):
        frame = av.VideoFrame.from_ndarray(np.zeros((180, 320, 3), dtype=np.uint8), format='rgb24')
        frame.pts = i
        for packet in video.encode(frame): output.mux(packet)
    for packet in video.encode(): output.mux(packet)
    for frame in source.decode(audio=0):
        for packet in audio.encode(frame): output.mux(packet)
    for packet in audio.encode(): output.mux(packet)
print(folder / 'jfk.mp4')
