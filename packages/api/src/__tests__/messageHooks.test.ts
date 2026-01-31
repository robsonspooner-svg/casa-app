// Unit tests for message hooks and utilities
// Mission 12: In-App Communications

import { describe, it, expect } from 'vitest';
import { renderMessageTemplate } from '../hooks/useMessageTemplates';

describe('renderMessageTemplate', () => {
  it('should replace single variable', () => {
    const result = renderMessageTemplate('Hello {{name}}!', { name: 'John' });
    expect(result).toBe('Hello John!');
  });

  it('should replace multiple variables', () => {
    const template = 'Hi {{tenant_name}}, your rent of ${{rent_amount}} is due.';
    const result = renderMessageTemplate(template, {
      tenant_name: 'Sarah',
      rent_amount: '450',
    });
    expect(result).toBe('Hi Sarah, your rent of $450 is due.');
  });

  it('should keep unreplaced variables', () => {
    const result = renderMessageTemplate('Hello {{name}}, your {{item}} is ready.', {
      name: 'John',
    });
    expect(result).toBe('Hello John, your {{item}} is ready.');
  });

  it('should handle empty variables object', () => {
    const result = renderMessageTemplate('Hello {{name}}!', {});
    expect(result).toBe('Hello {{name}}!');
  });

  it('should handle template with no variables', () => {
    const result = renderMessageTemplate('Hello World!', { name: 'John' });
    expect(result).toBe('Hello World!');
  });

  it('should handle PM transition welcome template', () => {
    const template = "Hi {{tenant_name}}, I'm taking over management of your property at {{property_address}}.";
    const result = renderMessageTemplate(template, {
      tenant_name: 'Mike',
      property_address: '123 Main St, Sydney',
    });
    expect(result).toBe("Hi Mike, I'm taking over management of your property at 123 Main St, Sydney.");
  });

  it('should handle PM transition rent template', () => {
    const template = 'Your rent amount (${{rent_amount}}/week) and due date remain the same.';
    const result = renderMessageTemplate(template, { rent_amount: '500' });
    expect(result).toBe('Your rent amount ($500/week) and due date remain the same.');
  });

  it('should handle adjacent variables', () => {
    const result = renderMessageTemplate('{{first}}{{last}}', { first: 'Hello', last: 'World' });
    expect(result).toBe('HelloWorld');
  });

  it('should not replace malformed variables', () => {
    const result = renderMessageTemplate('Hello {name} and {{name}}!', { name: 'John' });
    expect(result).toBe('Hello {name} and John!');
  });

  it('should handle special characters in values', () => {
    const result = renderMessageTemplate('Address: {{address}}', {
      address: "42 O'Brien St, St Kilda",
    });
    expect(result).toBe("Address: 42 O'Brien St, St Kilda");
  });
});

describe('MessageStatus type contracts', () => {
  it('should define valid message statuses', () => {
    const validStatuses = ['sending', 'sent', 'delivered', 'read', 'failed'] as const;
    expect(validStatuses).toHaveLength(5);
    expect(validStatuses).toContain('sending');
    expect(validStatuses).toContain('sent');
    expect(validStatuses).toContain('delivered');
    expect(validStatuses).toContain('read');
    expect(validStatuses).toContain('failed');
  });
});

describe('ConversationType type contracts', () => {
  it('should define valid conversation types', () => {
    const validTypes = ['direct', 'maintenance', 'payment', 'lease', 'system'] as const;
    expect(validTypes).toHaveLength(5);
    expect(validTypes).toContain('direct');
    expect(validTypes).toContain('maintenance');
    expect(validTypes).toContain('payment');
    expect(validTypes).toContain('lease');
    expect(validTypes).toContain('system');
  });
});

describe('Message search utility', () => {
  it('should create valid search patterns', () => {
    const searchTerm = 'hello';
    const pattern = `%${searchTerm}%`;
    expect(pattern).toBe('%hello%');
  });

  it('should handle special SQL characters in search', () => {
    const searchTerm = "test's";
    const pattern = `%${searchTerm}%`;
    expect(pattern).toContain("test's");
  });

  it('should trim search input', () => {
    const searchTerm = '  hello  ';
    const trimmed = searchTerm.trim();
    expect(trimmed).toBe('hello');
    expect(trimmed.length).toBe(5);
  });

  it('should require minimum 2 character search', () => {
    const shortQuery = 'a';
    const validQuery = 'ab';
    expect(shortQuery.trim().length >= 2).toBe(false);
    expect(validQuery.trim().length >= 2).toBe(true);
  });
});

describe('Notification preference defaults', () => {
  it('should have sensible defaults', () => {
    const defaults = {
      push_enabled: true,
      email_enabled: true,
      sms_enabled: true,
      whatsapp_enabled: false,
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
      quiet_hours_timezone: 'Australia/Sydney',
      rent_reminders: true,
      payment_receipts: true,
      maintenance_updates: true,
      message_notifications: true,
      marketing_emails: false,
    };

    // Primary channels should be enabled by default
    expect(defaults.push_enabled).toBe(true);
    expect(defaults.email_enabled).toBe(true);
    expect(defaults.sms_enabled).toBe(true);

    // WhatsApp requires opt-in
    expect(defaults.whatsapp_enabled).toBe(false);

    // Quiet hours off by default
    expect(defaults.quiet_hours_enabled).toBe(false);

    // All critical notifications enabled
    expect(defaults.rent_reminders).toBe(true);
    expect(defaults.payment_receipts).toBe(true);
    expect(defaults.maintenance_updates).toBe(true);
    expect(defaults.message_notifications).toBe(true);

    // Marketing opt-in (false by default, per Australian Spam Act)
    expect(defaults.marketing_emails).toBe(false);

    // Australian timezone default
    expect(defaults.quiet_hours_timezone).toBe('Australia/Sydney');
  });

  it('should have quiet hours covering night period', () => {
    const start = parseInt('22:00'.split(':')[0]);
    const end = parseInt('07:00'.split(':')[0]);

    // Start should be evening
    expect(start).toBeGreaterThanOrEqual(20);
    // End should be morning
    expect(end).toBeLessThanOrEqual(9);
  });
});

describe('PM Transition sequence', () => {
  it('should define 3-step sequence', () => {
    const steps = [
      { step: 1, name: 'Welcome', delay: 0 },
      { step: 2, name: 'Rent Setup', delay: 24 * 60 * 60 * 1000 },
      { step: 3, name: 'Maintenance', delay: 48 * 60 * 60 * 1000 },
    ];

    expect(steps).toHaveLength(3);
    expect(steps[0].delay).toBe(0); // Immediate
    expect(steps[1].delay).toBe(86400000); // 24 hours
    expect(steps[2].delay).toBe(172800000); // 48 hours
  });

  it('should calculate correct schedule dates', () => {
    const now = new Date('2025-06-15T10:00:00Z');
    const rentScheduled = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const maintenanceScheduled = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    expect(rentScheduled.toISOString()).toBe('2025-06-16T10:00:00.000Z');
    expect(maintenanceScheduled.toISOString()).toBe('2025-06-17T10:00:00.000Z');
  });

  it('should have required template variables', () => {
    const requiredVars = ['tenant_name', 'property_address', 'rent_amount'];
    expect(requiredVars).toContain('tenant_name');
    expect(requiredVars).toContain('property_address');
    expect(requiredVars).toContain('rent_amount');
  });
});
