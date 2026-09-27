import { Modal, ModalProps } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { ReactNode } from 'react';

export interface BaseModalProps {
  opened: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  size?: ModalProps['size'];
}

export function BaseModal({ opened, onClose, title, children, size = 'md' }: BaseModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)');

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size={isMobile ? '100%' : size}
      centered={!isMobile}
      fullScreen={isMobile}
      transitionProps={{
        transition: isMobile ? 'slide-up' : 'fade',
        duration: 200,
      }}
      styles={
        isMobile
          ? {
              content: {
                borderRadius: '16px 16px 0 0',
              },
              inner: {
                alignItems: 'flex-end',
              },
            }
          : undefined
      }
    >
      {children}
    </Modal>
  );
}
