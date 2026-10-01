import { Container, Divider, Stack, Text, Title } from '@mantine/core';
import { generateSeo } from '@/lib/seo';

export const metadata = generateSeo({
  title: 'Syarat & Ketentuan | Raia',
  description:
    'Syarat dan ketentuan penggunaan platform investasi ternak Raia. Dokumen kerangka, akan diisi tim legal.',
  path: '/syarat-ketentuan',
  keywords: ['syarat dan ketentuan', 'ketentuan layanan Raia', 'investasi ternak'],
});

// Struktur bagian sengaja disiapkan lebih dulu; isi klausul diisi tim legal,
// bukan dikarang di kode.
const sections = [
  {
    title: '1. Pendahuluan',
    body: '[ISI: ruang lingkup perjanjian, pihak yang terikat, dan tanggal berlaku.]',
  },
  {
    title: '2. Definisi',
    body: '[ISI: definisi istilah yang dipakai, misalnya investor, operator, paket, lot, dan ta\'awun.]',
  },
  {
    title: '3. Hak & Kewajiban Investor',
    body: '[ISI: hak dan kewajiban investor saat mendaftar, membeli paket, dan menerima bagi hasil.]',
  },
  {
    title: '4. Risiko',
    body: '[ISI: penjelasan risiko investasi ternak dan pernyataan bahwa hasil tidak dijamin.]',
  },
  {
    title: '5. Pembayaran & Bagi Hasil',
    body: '[ISI: mekanisme pembayaran, jadwal, dan perhitungan bagi hasil.]',
  },
  {
    title: '6. Secondary Market',
    body: '[ISI: aturan jual beli kepemilikan di pasar sekunder dan biaya yang berlaku.]',
  },
  {
    title: '7. Ta\'awun',
    body: '[ISI: ketentuan skema tolong-menolong ta\'awun dan syarat klaimnya.]',
  },
  {
    title: '8. Penghentian',
    body: '[ISI: alasan dan tata cara penghentian akun atau kerja sama.]',
  },
  {
    title: '9. Perubahan Ketentuan',
    body: '[ISI: cara pemberitahuan dan berlaku efektifnya perubahan ketentuan ini.]',
  },
  {
    title: '10. Kontak',
    body: '[ISI: alamat surel dan kanal resmi untuk pertanyaan hukum.]',
  },
];

export default function SyaratKetentuanPage() {
  return (
    <Container size="md" py={60}>
      <Stack gap="lg">
        <div>
          <Title order={1} mb="sm">
            Syarat & Ketentuan
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
