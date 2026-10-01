import { Drawer, Modal, ModalProps } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { ReactNode } from 'react';

export interface BaseModalProps {
  opened: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: ModalProps['size'];
}

// Di bawah 768px modal tengah terasa seperti dialog desktop di HP. Drawer
// position="bottom" memberi pola bottom sheet. API prop BaseModal tidak berubah,
// jadi pemanggil tidak perlu disesuaikan.
export function BaseModal({ opened, onClose, title, children, size = 'md' }: BaseModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)');

  if (isMobile) {
    return (
      <Drawer
        opened={opened}
        onClose={onClose}
        title={title}
        position="bottom"
        transitionProps={{ transition: 'slide-up', duration: 200 }}
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
        styles={{
          content: {
            // Tinggi mengikuti isi, bukan tinggi tetap Drawer, supaya sheet
            // tidak menyisakan ruang kosong untuk konten pendek.
            height: 'auto',
            maxHeight: '90dvh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          },
        }}
      >
        {children}
      </Drawer>
    );
  }

  return (
    <Modal opened={opened} onClose={onClose} title={title} size={size} centered>
      {children}
    </Modal>
  );
}
