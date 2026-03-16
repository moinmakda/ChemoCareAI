/**
 * Detox E2E Test: Login Flow
 */
import { by, device, element, expect } from 'detox';

describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should show login screen on first launch', async () => {
    await expect(element(by.text('Welcome Back'))).toBeVisible();
    await expect(element(by.text('Sign in to continue'))).toBeVisible();
  });

  it('should show error for invalid credentials', async () => {
    await element(by.id('email-input')).typeText('invalid@email.com');
    await element(by.id('password-input')).typeText('wrongpassword');
    await element(by.text('Sign In')).tap();

    await expect(element(by.text('Invalid credentials'))).toBeVisible();
  });

  it('should login successfully with valid patient credentials', async () => {
    await element(by.id('email-input')).clearText();
    await element(by.id('email-input')).typeText('patient@chemocare.com');
    await element(by.id('password-input')).clearText();
    await element(by.id('password-input')).typeText('password123');
    await element(by.text('Sign In')).tap();

    // Wait for navigation and verify home screen
    await waitFor(element(by.text('Welcome')))
      .toBeVisible()
      .withTimeout(5000);
    
    await expect(element(by.text('Upcoming Appointments'))).toBeVisible();
  });

  it('should navigate to forgot password screen', async () => {
    await element(by.text('Forgot Password?')).tap();
    
    await expect(element(by.text('Reset Password'))).toBeVisible();
    await expect(element(by.id('email-input'))).toBeVisible();
  });

  it('should navigate to registration screen', async () => {
    await element(by.text("Don't have an account?")).tap();
    
    await expect(element(by.text('Create Account'))).toBeVisible();
  });
});
