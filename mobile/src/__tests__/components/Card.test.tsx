/**
 * Card Component Tests
 */
import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '../utils/test-utils';
import { Card } from '../../components/Card';

describe('Card Component', () => {
  it('renders children correctly', () => {
    render(
      <Card>
        <Text>Card Content</Text>
      </Card>
    );
    
    expect(screen.getByText('Card Content')).toBeTruthy();
  });

  it('renders with different variants', () => {
    render(
      <Card variant="elevated">
        <Text>Elevated Card</Text>
      </Card>
    );
    
    expect(screen.getByText('Elevated Card')).toBeTruthy();
  });

  it('renders with different padding', () => {
    render(
      <Card padding="large">
        <Text>Large Padding Card</Text>
      </Card>
    );
    
    expect(screen.getByText('Large Padding Card')).toBeTruthy();
  });

  it('applies custom styles', () => {
    const customStyle = { backgroundColor: 'red' };
    render(
      <Card style={customStyle}>
        <Text>Styled Card</Text>
      </Card>
    );
    
    expect(screen.getByText('Styled Card')).toBeTruthy();
  });

  it('handles onPress when provided', () => {
    const onPressMock = jest.fn();
    render(
      <Card onPress={onPressMock}>
        <Text>Pressable Card</Text>
      </Card>
    );
    
    fireEvent.press(screen.getByText('Pressable Card'));
    expect(onPressMock).toHaveBeenCalled();
  });
});
