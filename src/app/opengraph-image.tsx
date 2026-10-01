import { ImageResponse } from 'next/og';

export const alt = 'Raia: Investasi Ternak';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #0F766E 0%, #14513B 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 128,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          Raia
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 48,
            fontWeight: 500,
            color: '#D1FAE5',
          }}
        >
          Investasi ternak gotong royong
        </div>
      </div>
    ),
    { ...size },
  );
}
