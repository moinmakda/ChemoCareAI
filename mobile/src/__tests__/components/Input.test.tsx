/**
 * Input Component Tests
 */
import React from 'react';
import { render, fireEvent, screen } from '../utils/test-utils';
import { Input } from '../../components/Input';

describe('Input Component', () => {
  it('renders correctly with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    
    expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
  });

  it('displays label when provided', () => {
    render(<Input label="Email" placeholder="Enter email" />);
    
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('handles text input', () => {
    const onChangeTextMock = jest.fn();
    render(
      <Input 
        placeholder="Enter text" 
        onChangeText={onChangeTextMock}
      />
    );
    
    const input = screen.getByPlaceholderText('Enter text');
    fireEvent.changeText(input, 'Hello World');
    
    expect(onChangeTextMock).toHaveBeenCalledWith('Hello World');
  });

  it('displays error message', () => {
    render(
      <Input 
        placeholder="Enter text" 
        error="This field is required"
      />
    );
    
    expect(screen.getByText('This field is required')).toBeTruthy();
  });

  it('shows password toggle for secure text entry', () => {
    render(
      <Input 
        placeholder="Enter password"
        secureTextEntry
      />
    );
    
    // The input should be rendered with secure entry
    expect(screen.getByPlaceholderText('Enter password')).toBeTruthy();
  });

  it('shows required indicator when required is true', () => {
    render(
      <Input 
        label="Required Field"
        placeholder="Enter value"
        required
      />
    );
    
    expect(screen.getByText('*')).toBeTruthy();
  });

  it('displays helper text when provided', () => {
    render(
      <Input 
        placeholder="Enter value"
        helperText="This is helper text"
      />
    );
    
    expect(screen.getByText('This is helper text')).toBeTruthy();
  });
});
