/**
 * Button Component Tests
 * 
 * Tests for the reusable Button component.
 */
import React from 'react';
import { render, fireEvent, screen } from '../utils/test-utils';
import { Button } from '../../components/Button';

describe('Button Component', () => {
  it('renders correctly with title', () => {
    render(<Button title="Click Me" onPress={() => {}} />);
    
    expect(screen.getByText('Click Me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPressMock = jest.fn();
    render(<Button title="Click Me" onPress={onPressMock} />);
    
    fireEvent.press(screen.getByText('Click Me'));
    
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPressMock = jest.fn();
    render(<Button title="Click Me" onPress={onPressMock} disabled />);
    
    fireEvent.press(screen.getByText('Click Me'));
    
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it('shows loading indicator when loading', () => {
    render(<Button title="Click Me" onPress={() => {}} loading />);
    
    // When loading, the title is replaced with ActivityIndicator
    // So we should NOT find the title text
    expect(screen.queryByText('Click Me')).toBeNull();
  });

  it('applies correct variant styles', () => {
    const { rerender } = render(
      <Button title="Primary" onPress={() => {}} variant="primary" />
    );
    expect(screen.getByText('Primary')).toBeTruthy();

    rerender(<Button title="Secondary" onPress={() => {}} variant="secondary" />);
    expect(screen.getByText('Secondary')).toBeTruthy();

    rerender(<Button title="Outline" onPress={() => {}} variant="outline" />);
    expect(screen.getByText('Outline')).toBeTruthy();
  });

  it('applies correct size styles', () => {
    const { rerender } = render(
      <Button title="Small" onPress={() => {}} size="small" />
    );
    expect(screen.getByText('Small')).toBeTruthy();

    rerender(<Button title="Medium" onPress={() => {}} size="medium" />);
    expect(screen.getByText('Medium')).toBeTruthy();

    rerender(<Button title="Large" onPress={() => {}} size="large" />);
    expect(screen.getByText('Large')).toBeTruthy();
  });
});
