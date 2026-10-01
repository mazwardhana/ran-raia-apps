'use client';

import { Accordion, Text } from '@mantine/core';
import { FAQ_ITEMS } from './data';

// Accordion Mantine tersusun dari beberapa sub-komponen (Accordion.Item,
// Accordion.Control, Accordion.Panel). RSC tidak bisa meresolusi compound
// component seperti itu dari Server Component, jadi bagian ini dipisah ke
// Client Component. FAQ_ITEMS statis, aman diimpor dari sisi klien.
export function FaqAccordion() {
  return (
    <Accordion
      variant="separated"
      radius="md"
      chevronPosition="right"
      defaultValue={FAQ_ITEMS[0].question}
    >
      {FAQ_ITEMS.map((item) => (
        <Accordion.Item key={item.question} value={item.question}>
          <Accordion.Control>
            <Text fw={600} size="md">{item.question}</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Text size="sm" c="dimmed">{item.answer}</Text>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}
