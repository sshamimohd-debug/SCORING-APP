from pathlib import Path
import base64, gzip
parts=[Path(f'qa/v4-src-{i:02d}.b64').read_text().strip() for i in range(4)]
data=gzip.decompress(base64.b64decode(''.join(parts)))
out=Path('js/cricpro-v4.js')
out.write_bytes(data)
print('reconstructed', out, len(data), 'bytes')
