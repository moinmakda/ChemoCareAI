/**
 * Pending Approvals Component
 * Shows pending protocol approvals for nurses and doctors
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../constants/theme';
import { Card } from './Card';
import { Badge } from './Badge';
import { getPendingApprovals, PendingApprovals, ProtocolRequest } from '../services/protocolService';

interface PendingApprovalsCardProps {
  userRole: 'nurse' | 'doctor';
  onRefresh?: () => void;
}

export const PendingApprovalsCard: React.FC<PendingApprovalsCardProps> = ({ 
  userRole,
  onRefresh 
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pendingData, setPendingData] = useState<PendingApprovals | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPendingApprovals = async () => {
    try {
      setError(null);
      const data = await getPendingApprovals();
      setPendingData(data);
    } catch {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  // Refresh when parent requests
  useEffect(() => {
    if (onRefresh) {
      loadPendingApprovals();
    }
  }, [onRefresh]);

  const handlePress = (request: ProtocolRequest) => {
    if (userRole === 'nurse') {
      // Nurse goes to review screen
      router.push({
        pathname: '/(nurse)/protocol-review',
        params: { requestId: request.id.toString() },
      });
    } else {
      // Doctor goes to approval screen
      const approvalPath = '/(doctor-opd)/protocol-approval';
      router.push({
        pathname: approvalPath as any,
        params: { requestId: request.id.toString() },
      });
    }
  };

  const pendingRequests = userRole === 'nurse'
    ? pendingData?.nursePending || []
    : pendingData?.doctorPending || [];

  if (loading) {
    return (
      <Card variant="outlined" padding="medium" style={styles.card}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
          <Text style={styles.loadingText}>Loading approvals...</Text>
        </View>
      </Card>
    );
  }

  if (error) {
    return null; // Silently hide on error
  }

  if (pendingRequests.length === 0) {
    return null; // Hide when no pending items
  }

  return (
    <Card variant="elevated" padding="medium" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="clipboard" size={24} color={colors.warning} />
          <Text style={styles.title}>Pending Approvals</Text>
        </View>
        <Badge 
          label={`${pendingRequests.length}`} 
          variant="warning" 
          size="small" 
        />
      </View>

      {pendingRequests.slice(0, 3).map((request) => (
        <TouchableOpacity
          key={request.id}
          style={styles.requestItem}
          onPress={() => handlePress(request)}
        >
          <View style={styles.requestInfo}>
            <Text style={styles.requestTitle}>
              Protocol Request #{request.id}
            </Text>
            <Text style={styles.requestMeta}>
              {request.status?.replace('_', ' ')} • {new Date(request.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        </TouchableOpacity>
      ))}

      {pendingRequests.length > 3 && (
        <Text style={styles.moreText}>
          +{pendingRequests.length - 3} more pending approvals
        </Text>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  loadingText: {
    marginLeft: spacing.sm,
    fontSize: typography.body.fontSize,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.headline.fontSize,
    fontWeight: typography.headline.fontWeight as TextStyle['fontWeight'],
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  requestInfo: {
    flex: 1,
  },
  requestTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.text.primary,
  },
  requestMeta: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },
  moreText: {
    fontSize: typography.caption1.fontSize,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default PendingApprovalsCard;
