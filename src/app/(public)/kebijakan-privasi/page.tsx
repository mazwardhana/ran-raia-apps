import { Container, Divider, Stack, Text, Title } from '@mantine/core';
import { generateSeo } from '@/lib/seo';

export const metadata = generateSeo({
  title: 'Kebijakan Privasi | Raia',
  description:
    'Kebijakan privasi platform investasi ternak Raia, termasuk penyimpanan data KYC. Dokumen kerangka, akan diisi tim legal.',
  path: '/kebijakan-privasi',
  keywords: ['kebijakan privasi', 'perlindungan data Raia', 'KYC'],
});

// Struktur bagian sengaja disiapkan lebih dulu; isi klausul diisi tim legal,
// bukan dikarang di kode.
const sections = [
  {
    title: '1. Data yang Dikumpulkan',
    body: '[ISI: jenis data pribadi yang dikumpulkan, misalnya identitas, kontak, dan data transaksi.]',
  },
  {
    title: '2. Dasar Hukum',
    body: '[ISI: dasar hukum pemrosesan data menurut peraturan yang berlaku.]',
  },
  {
    title: '3. Penggunaan Data',
    body: '[ISI: tujuan penggunaan data, misalnya verifikasi akun, pembayaran, dan layanan.]',
  },
  {
    title: '4. Penyimpanan KYC',
    body: '[ISI: cara penyimpanan dokumen KYC, masa simpan, dan pengamanannya.]',
  },
  {
    title: '5. Berbagi ke Pihak Ketiga',
    body: '[ISI: pihak ketiga penerima data dan dasar pembagiannya.]',
  },
  {
    title: '6. Hak Subjek Data',
    body: '[ISI: hak akses, koreksi, penghapusan, dan cara mengajukannya.]',
  },
  {
    title: '7. Retensi',
    body: '[ISI: jangka waktu penyimpanan data dan alasan retensi.]',
  },
  {
    title: '8. Kontak',
    body: '[ISI: alamat surel dan kanal resmi untuk pertanyaan privasi.]',
  },
];

export default function KebijakanPrivasiPage() {
  return (
    <Container size="md" py={60}>
      <Stack gap="lg">
        <div>
          <Title order={1} mb="sm">
            Kebijakan Privasi
          </Title>
          <Text c="dimmed">
            Dokumen ini kerangka; akan diisi tim legal.
          </Text>
        </div>

        <Divider />

        {sections.map((section) => (
          <Stack key={section.title} gap="xs">
            <Title order={2} size="h4">
              {section.title}
            </Title>
            <Text c="dimmed">{section.body}</Text>
          </Stack>
        ))}
      </Stack>
    </Container>
  );
}
