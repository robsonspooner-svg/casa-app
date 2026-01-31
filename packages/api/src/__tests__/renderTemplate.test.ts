// Unit tests for renderTemplate function
// Mission 08: Arrears & Late Payment Management

import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../hooks/useReminderTemplates';
import type { ReminderTemplate } from '../types/database';

// Helper to create a mock template
function createMockTemplate(overrides: Partial<ReminderTemplate> = {}): ReminderTemplate {
  return {
    id: 'test-id',
    owner_id: null,
    name: 'Test Template',
    days_overdue: 1,
    channel: 'email',
    subject: 'Test Subject',
    body: 'Test Body',
    is_active: true,
    is_breach_notice: false,
    applicable_states: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('renderTemplate', () => {
  it('should render a template with no variables unchanged', () => {
    const template = createMockTemplate({
      subject: 'Hello World',
      body: 'This is a test message.',
    });

    const result = renderTemplate(template, {});

    expect(result.subject).toBe('Hello World');
    expect(result.body).toBe('This is a test message.');
  });

  it('should replace single variable in subject', () => {
    const template = createMockTemplate({
      subject: 'Rent Reminder - {{property_address}}',
      body: 'Body text',
    });

    const result = renderTemplate(template, {
      property_address: '123 Main St, Sydney',
    });

    expect(result.subject).toBe('Rent Reminder - 123 Main St, Sydney');
    expect(result.body).toBe('Body text');
  });

  it('should replace single variable in body', () => {
    const template = createMockTemplate({
      subject: 'Subject',
      body: 'Dear {{tenant_name}}, please pay your rent.',
    });

    const result = renderTemplate(template, {
      tenant_name: 'John Smith',
    });

    expect(result.body).toBe('Dear John Smith, please pay your rent.');
  });

  it('should replace multiple variables', () => {
    const template = createMockTemplate({
      subject: 'Rent Overdue - {{property_address}}',
      body: 'Dear {{tenant_name}},\n\nYour rent of {{amount}} is {{days_overdue}} days overdue.\n\nRegards,\n{{owner_name}}',
    });

    const result = renderTemplate(template, {
      property_address: '456 Oak Ave',
      tenant_name: 'Jane Doe',
      amount: '$500.00',
      days_overdue: 7,
      owner_name: 'Bob Wilson',
    });

    expect(result.subject).toBe('Rent Overdue - 456 Oak Ave');
    expect(result.body).toBe('Dear Jane Doe,\n\nYour rent of $500.00 is 7 days overdue.\n\nRegards,\nBob Wilson');
  });

  it('should replace same variable multiple times', () => {
    const template = createMockTemplate({
      subject: '{{tenant_name}} - Urgent',
      body: 'Hi {{tenant_name}}, this is a reminder for {{tenant_name}}.',
    });

    const result = renderTemplate(template, {
      tenant_name: 'Test User',
    });

    expect(result.subject).toBe('Test User - Urgent');
    expect(result.body).toBe('Hi Test User, this is a reminder for Test User.');
  });

  it('should leave unreplaced variables as-is', () => {
    const template = createMockTemplate({
      subject: 'Hello {{unknown_variable}}',
      body: 'The {{missing}} value is not provided.',
    });

    const result = renderTemplate(template, {
      tenant_name: 'John',
    });

    expect(result.subject).toBe('Hello {{unknown_variable}}');
    expect(result.body).toBe('The {{missing}} value is not provided.');
  });

  it('should handle numeric values', () => {
    const template = createMockTemplate({
      subject: 'Day {{days_overdue}} Reminder',
      body: 'Amount: {{amount}}',
    });

    const result = renderTemplate(template, {
      days_overdue: 14,
      amount: 1500.50,
    });

    expect(result.subject).toBe('Day 14 Reminder');
    expect(result.body).toBe('Amount: 1500.5');
  });

  it('should handle empty string values', () => {
    const template = createMockTemplate({
      subject: 'From: {{owner_name}}',
      body: 'Message',
    });

    const result = renderTemplate(template, {
      owner_name: '',
    });

    expect(result.subject).toBe('From: ');
  });

  it('should handle realistic arrears template', () => {
    const template = createMockTemplate({
      subject: 'Overdue Rent Notice - {{property_address}}',
      body: `Dear {{tenant_name}},

Our records show that your rent payment of {{amount}} is now {{days_overdue}} days overdue.

Total outstanding: {{total_arrears}}

Please make payment immediately to avoid any further action.

If you are experiencing financial difficulties, please contact us to discuss a payment arrangement.

Regards,
{{owner_name}}`,
    });

    const result = renderTemplate(template, {
      property_address: '10 Smith St, Melbourne VIC 3000',
      tenant_name: 'Sarah Johnson',
      amount: '$650.00',
      days_overdue: 8,
      total_arrears: '$650.00',
      owner_name: 'Michael Brown',
    });

    expect(result.subject).toBe('Overdue Rent Notice - 10 Smith St, Melbourne VIC 3000');
    expect(result.body).toContain('Dear Sarah Johnson,');
    expect(result.body).toContain('$650.00 is now 8 days overdue');
    expect(result.body).toContain('Michael Brown');
  });

  it('should handle breach notice template with legal content', () => {
    const template = createMockTemplate({
      is_breach_notice: true,
      subject: 'Notice of Breach - Non-Payment of Rent',
      body: `NOTICE OF BREACH OF RESIDENTIAL TENANCY AGREEMENT

To: {{tenant_name}}
Property: {{property_address}}

You are in breach of your residential tenancy agreement for non-payment of rent.

Rent owing: {{total_arrears}}
Period: {{overdue_period}}

You must pay the full amount within 14 days of receiving this notice to remedy the breach.

Date: {{today}}

{{owner_name}}`,
    });

    const result = renderTemplate(template, {
      tenant_name: 'Alex Thompson',
      property_address: '5 Beach Rd, Bondi NSW 2026',
      total_arrears: '$2,500.00',
      overdue_period: '1 April 2024 to 15 April 2024',
      today: '20 April 2024',
      owner_name: 'Property Owner Pty Ltd',
    });

    expect(result.body).toContain('To: Alex Thompson');
    expect(result.body).toContain('Property: 5 Beach Rd, Bondi NSW 2026');
    expect(result.body).toContain('Rent owing: $2,500.00');
    expect(result.body).toContain('Date: 20 April 2024');
  });

  it('should not replace variables without double braces', () => {
    const template = createMockTemplate({
      subject: 'Hello {tenant_name}',
      body: 'Single brace: {amount}, Double brace: {{amount}}',
    });

    const result = renderTemplate(template, {
      tenant_name: 'John',
      amount: '$100',
    });

    expect(result.subject).toBe('Hello {tenant_name}');
    expect(result.body).toBe('Single brace: {amount}, Double brace: $100');
  });

  it('should handle special characters in values', () => {
    const template = createMockTemplate({
      subject: 'Property: {{property_address}}',
      body: 'Owner: {{owner_name}}',
    });

    const result = renderTemplate(template, {
      property_address: "O'Brien's Place, Unit 1/2",
      owner_name: 'Smith & Jones Property Management',
    });

    expect(result.subject).toBe("Property: O'Brien's Place, Unit 1/2");
    expect(result.body).toBe('Owner: Smith & Jones Property Management');
  });
});
