/**
 * Discharge Summary Screen
 *
 * Read-only view of the auto-generated discharge summary for a completed
 * treatment cycle.  Accessible via navigation from the Active Treatments
 * screen after completing a cycle.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/constants/theme';
import { Header } from '../../src/components';
import { treatmentService } from '../../src/services/treatmentService';

interface DischargeSummary {
  patientName: string;
  patientAge?: number;
  diagnosis?: string;
  protocolName: string;
  cycleNumber: number;
  totalCycles: number;
  cycleDate: string;
  drugsAdministered: Array<{
    drugName: string;
    plannedDose: number;
    actualDose?: number;
    unit: string;
    route: string;
    status: string;
    plannedDurationMins?: number;
    actualDurationMins?: number;
  }>;
  vitals?: Record<string, any>;
  reactions?: string[];
  doseModifications?: string;
  nextCycleDate?: string;
  nextCycleNumber?: number;
  takeHomeMedications: Array<{
    drugName: string;
    dose: string | number;
    unit: string;
    route: string;
    frequency: string;
    duration: string;
    instructions: string;
  }>;
  followUpInstructions: string;
  warningSigns: string[];
  generatedAt: string;
}

export default function DischargeSummaryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cycleId } = useLocalSearchParams<{ cycleId: string }>();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DischargeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cycleId) {
      fetchSummary();
    }
  }, [cycleId]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await treatmentService.getDischargeSummary(cycleId!);
      setSummary(data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load discharge summary');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!summary) return;

    const text = buildShareText(summary);
    try {
      await Share.share({
        message: text,
        title: `Discharge Summary - ${summary.patientName}`,
      });
    } catch {
      // User cancelled or share failed silently
    }
  };

  const generatePDF = async () => {
    if (!summary) return;
    try {
      const html = buildPdfHtml(summary);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Discharge Summary — ${summary.patientName}` });
      } else {
        Alert.alert('PDF Saved', `File saved to: ${uri}`);
      }
    } catch {
      Alert.alert('Error', 'Failed to generate PDF');
    }
  };

  const buildPdfHtml = (s: DischargeSummary): string => {
    const drugsRows = s.drugsAdministered.map(d => {
      const dose = d.actualDose ?? d.plannedDose;
      const doseStr = dose ? `${dose} ${d.unit}` : 'Per label';
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0;font-weight:500">${d.drugName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0">${doseStr}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0">${d.route}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0">${d.plannedDurationMins ? d.plannedDurationMins + ' min' : '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #E2E8F0">
          <span style="background:${d.status === 'completed' ? '#DEF7EC' : '#FEF3C7'};color:${d.status === 'completed' ? '#03543F' : '#92400E'};padding:2px 8px;border-radius:10px;font-size:11px">${d.status}</span>
        </td>
      </tr>`;
    }).join('');

    const vitalsHtml = s.vitals && Object.keys(s.vitals).length > 0
      ? Object.entries(s.vitals).map(([k, v]) => `
        <div style="text-align:center;padding:12px;background:#F8FAFC;border-radius:8px;min-width:100px">
          <div style="font-size:22px;font-weight:700;color:#1E293B">${v}</div>
          <div style="font-size:11px;color:#64748B;margin-top:4px">${formatVitalLabel(k)}</div>
        </div>`).join('')
      : '<p style="color:#94A3B8;font-style:italic">No vitals recorded</p>';

    const takeHomeRows = s.takeHomeMedications.length > 0
      ? s.takeHomeMedications.map(m => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;font-weight:500">${m.drugName || (m as any).name || ''}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #E2E8F0">${m.dose || ''} ${m.unit || ''}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #E2E8F0">${m.route || ''}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#64748B">${m.instructions || m.frequency || ''}</td>
        </tr>`).join('')
      : '<tr><td colspan="4" style="padding:12px;color:#94A3B8;text-align:center">As per protocol</td></tr>';

    const reactionsHtml = s.reactions && s.reactions.length > 0
      ? `<div style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0">
          <strong style="color:#92400E">Reactions During Treatment</strong>
          <ul style="margin:8px 0 0;padding-left:20px">${s.reactions.map(r => `<li style="color:#92400E;margin:4px 0">${r}</li>`).join('')}</ul>
        </div>`
      : '';

    const warningItems = s.warningSigns.map(w => `
      <li style="margin:6px 0;color:#991B1B">${w}</li>
    `).join('');

    // Build cycle calendar mini-view
    const totalCycles = s.totalCycles || 6;
    const completed = s.cycleNumber;
    const calendarDots = Array.from({ length: totalCycles }, (_, i) => {
      const num = i + 1;
      const bg = num < completed ? '#22C55E' : num === completed ? '#0066CC' : '#E2E8F0';
      const fg = num <= completed ? '#FFF' : '#94A3B8';
      return `<div style="width:36px;height:36px;border-radius:18px;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${num}</div>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:#1E293B; background:#FFF; }
    .page { max-width:800px; margin:0 auto; padding:0; }
    table { width:100%; border-collapse:collapse; }
    th { text-align:left; padding:10px 12px; background:#F1F5F9; font-size:12px; color:#64748B; text-transform:uppercase; letter-spacing:0.5px; }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0066CC 0%,#004999 100%);padding:32px 40px;color:white">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <h1 style="font-size:28px;font-weight:800;margin:0">Discharge Summary</h1>
        <p style="opacity:0.8;margin-top:4px;font-size:14px">ChemoCare by Jivana AI</p>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;opacity:0.7">Date</div>
        <div style="font-size:16px;font-weight:600">${formatDate(s.cycleDate)}</div>
      </div>
    </div>
  </div>

  <!-- Patient Info -->
  <div style="display:flex;gap:20px;padding:24px 40px;background:#F8FAFC;border-bottom:2px solid #E2E8F0">
    <div style="flex:1">
      <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px">Patient</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">${s.patientName}</div>
      ${s.patientAge ? `<div style="color:#64748B;margin-top:2px">${s.patientAge} years</div>` : ''}
    </div>
    <div style="flex:1">
      <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px">Diagnosis</div>
      <div style="font-size:16px;font-weight:600;margin-top:4px">${s.diagnosis || '—'}</div>
    </div>
    <div style="flex:1">
      <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px">Protocol</div>
      <div style="font-size:16px;font-weight:600;margin-top:4px;color:#0066CC">${s.protocolName}</div>
    </div>
  </div>

  <!-- Cycle Progress -->
  <div style="padding:20px 40px;border-bottom:1px solid #E2E8F0">
    <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Treatment Progress — Cycle ${s.cycleNumber} of ${totalCycles}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      ${calendarDots}
    </div>
    <div style="margin-top:12px;height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${Math.round((completed / totalCycles) * 100)}%;background:linear-gradient(90deg,#22C55E,#16A34A);border-radius:4px"></div>
    </div>
    <div style="margin-top:6px;font-size:12px;color:#64748B">${Math.round((completed / totalCycles) * 100)}% complete</div>
  </div>

  <!-- Drugs Administered -->
  <div style="padding:24px 40px">
    <h2 style="font-size:16px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <span style="display:inline-block;width:6px;height:20px;background:#0066CC;border-radius:3px"></span>
      Drugs Administered
    </h2>
    <table>
      <thead>
        <tr>
          <th>Drug</th><th>Dose</th><th>Route</th><th>Duration</th><th>Status</th>
        </tr>
      </thead>
      <tbody>${drugsRows}</tbody>
    </table>
  </div>

  ${reactionsHtml}

  <!-- Vitals -->
  <div style="padding:20px 40px">
    <h2 style="font-size:16px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <span style="display:inline-block;width:6px;height:20px;background:#F59E0B;border-radius:3px"></span>
      Vitals at Time of Treatment
    </h2>
    <div style="display:flex;gap:12px;flex-wrap:wrap">${vitalsHtml}</div>
  </div>

  <!-- Take-Home Medications -->
  <div style="padding:20px 40px;background:#F0FDF4;border-top:1px solid #BBF7D0;border-bottom:1px solid #BBF7D0">
    <h2 style="font-size:16px;font-weight:700;margin-bottom:12px;color:#166534;display:flex;align-items:center;gap:8px">
      <span style="display:inline-block;width:6px;height:20px;background:#22C55E;border-radius:3px"></span>
      Take-Home Medications
    </h2>
    <table>
      <thead><tr><th>Drug</th><th>Dose</th><th>Route</th><th>Instructions</th></tr></thead>
      <tbody>${takeHomeRows}</tbody>
    </table>
  </div>

  <!-- Next Appointment -->
  ${s.nextCycleDate ? `
  <div style="padding:20px 40px">
    <div style="background:linear-gradient(135deg,#EBF5FF,#DBEAFE);border:1px solid #93C5FD;border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:16px">
      <div style="width:48px;height:48px;background:#0066CC;border-radius:24px;display:flex;align-items:center;justify-content:center;color:white;font-size:20px">📅</div>
      <div>
        <div style="font-size:12px;color:#1E40AF;text-transform:uppercase;letter-spacing:0.5px">Next Appointment</div>
        <div style="font-size:18px;font-weight:700;color:#1E3A5F;margin-top:2px">Cycle ${s.nextCycleNumber} — ${formatDate(s.nextCycleDate)}</div>
        <div style="font-size:12px;color:#3B82F6;margin-top:2px">Please get pre-chemo blood work 2-3 days before</div>
      </div>
    </div>
  </div>` : ''}

  <!-- Follow-Up Instructions -->
  <div style="padding:20px 40px">
    <h2 style="font-size:16px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <span style="display:inline-block;width:6px;height:20px;background:#8B5CF6;border-radius:3px"></span>
      Follow-Up Instructions
    </h2>
    <div style="background:#F8FAFC;border-radius:8px;padding:16px;line-height:1.8;color:#334155">
      ${s.followUpInstructions.split('. ').filter(Boolean).map(line => `✓ ${line.trim()}.`).join('<br>')}
    </div>
  </div>

  <!-- Warning Signs -->
  <div style="padding:20px 40px;margin-bottom:20px">
    <div style="background:#FEF2F2;border:2px solid #FECACA;border-radius:12px;padding:20px">
      <h2 style="font-size:16px;font-weight:700;color:#991B1B;margin-bottom:12px">⚠ Warning Signs — Contact Clinic Immediately</h2>
      <ul style="list-style:none;padding:0;margin:0;columns:2;column-gap:20px">
        ${warningItems}
      </ul>
    </div>
  </div>

  <!-- Footer -->
  <div style="padding:16px 40px;background:#1E293B;color:white;display:flex;justify-content:space-between;align-items:center">
    <div>
      <span style="font-weight:700">ChemoCare</span>
      <span style="opacity:0.6;margin-left:8px">by Jivana AI</span>
    </div>
    <div style="font-size:12px;opacity:0.6">support@jivana.org.in | Generated ${formatDate(s.generatedAt)}</div>
  </div>

</div>
</body>
</html>`;
  };

  const buildShareText = (s: DischargeSummary): string => {
    const lines: string[] = [];
    lines.push('=== DISCHARGE SUMMARY ===');
    lines.push('');
    lines.push(`Patient: ${s.patientName}${s.patientAge ? `, Age ${s.patientAge}` : ''}`);
    if (s.diagnosis) lines.push(`Diagnosis: ${s.diagnosis}`);
    lines.push(`Protocol: ${s.protocolName}`);
    lines.push(`Cycle: ${s.cycleNumber} of ${s.totalCycles}`);
    lines.push(`Date: ${formatDate(s.cycleDate)}`);
    lines.push('');

    lines.push('--- Drugs Administered ---');
    for (const drug of s.drugsAdministered) {
      const dose = drug.actualDose ?? drug.plannedDose;
      lines.push(`  ${drug.drugName}: ${dose} ${drug.unit} (${drug.route})`);
    }
    lines.push('');

    if (s.vitals && Object.keys(s.vitals).length > 0) {
      lines.push('--- Vitals ---');
      for (const [key, val] of Object.entries(s.vitals)) {
        lines.push(`  ${formatVitalLabel(key)}: ${val}`);
      }
      lines.push('');
    }

    if (s.reactions && s.reactions.length > 0) {
      lines.push('--- Reactions ---');
      for (const r of s.reactions) {
        lines.push(`  - ${r}`);
      }
      lines.push('');
    }

    if (s.takeHomeMedications.length > 0) {
      lines.push('--- Take-Home Medications ---');
      for (const med of s.takeHomeMedications) {
        lines.push(`  ${med.drugName}: ${med.dose} ${med.unit} ${med.route}${med.frequency ? ` (${med.frequency})` : ''}`);
      }
      lines.push('');
    }

    if (s.nextCycleDate) {
      lines.push(`Next Cycle: Cycle ${s.nextCycleNumber} on ${formatDate(s.nextCycleDate)}`);
      lines.push('');
    }

    lines.push('--- Follow-Up Instructions ---');
    lines.push(s.followUpInstructions);
    lines.push('');

    lines.push('--- Warning Signs ---');
    for (const w of s.warningSigns) {
      lines.push(`  ! ${w}`);
    }

    lines.push('');
    lines.push('Generated by ChemoCare');

    return lines.join('\n');
  };

  const formatDate = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatVitalLabel = (key: string): string => {
    const labels: Record<string, string> = {
      temperatureF: 'Temperature',
      temperature_f: 'Temperature',
      pulseBpm: 'Pulse',
      pulse_bpm: 'Pulse',
      bloodPressure: 'Blood Pressure',
      blood_pressure: 'Blood Pressure',
      respiratoryRate: 'Respiratory Rate',
      respiratory_rate: 'Respiratory Rate',
      oxygenSaturation: 'SpO2',
      oxygen_saturation: 'SpO2',
      weightKg: 'Weight',
      weight_kg: 'Weight',
      painScore: 'Pain Score',
      pain_score: 'Pain Score',
    };
    return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatVitalValue = (key: string, val: any): string => {
    if (key.includes('temperature') || key.includes('Temperature')) return `${val}\u00B0F`;
    if (key.includes('pulse') || key.includes('Pulse')) return `${val} bpm`;
    if (key.includes('respiratory') || key.includes('Respiratory')) return `${val}/min`;
    if (key.includes('oxygen') || key.includes('Oxygen') || key.includes('SpO2')) return `${val}%`;
    if (key.includes('weight') || key.includes('Weight')) return `${val} kg`;
    if (key.includes('pain') || key.includes('Pain')) return `${val}/10`;
    return String(val);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Generating discharge summary...</Text>
      </View>
    );
  }

  if (error || !summary) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header title="Discharge Summary" />
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.errorTitle}>Unable to Load Summary</Text>
          <Text style={styles.errorText}>{error || 'No data available'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchSummary}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header title="Discharge Summary" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Patient Header */}
        <View style={styles.patientHeader}>
          <View style={styles.patientAvatar}>
            <Ionicons name="person" size={28} color={Colors.primary} />
          </View>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{summary.patientName}</Text>
            <Text style={styles.patientMeta}>
              {summary.patientAge ? `Age ${summary.patientAge}` : ''}
              {summary.patientAge && summary.diagnosis ? '  |  ' : ''}
              {summary.diagnosis || ''}
            </Text>
          </View>
        </View>

        {/* Protocol Info */}
        <View style={styles.section}>
          <View style={styles.protocolCard}>
            <View style={styles.protocolRow}>
              <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
              <Text style={styles.protocolName}>{summary.protocolName}</Text>
            </View>
            <View style={styles.cycleRow}>
              <View style={styles.cycleBadge}>
                <Text style={styles.cycleBadgeText}>
                  Cycle {summary.cycleNumber} of {summary.totalCycles}
                </Text>
              </View>
              <Text style={styles.cycleDate}>{formatDate(summary.cycleDate)}</Text>
            </View>
          </View>
        </View>

        {/* Drugs Administered */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drugs Administered</Text>
          {summary.drugsAdministered.map((drug, index) => (
            <View key={index} style={styles.drugRow}>
              <View style={styles.drugHeader}>
                <Text style={styles.drugName}>{drug.drugName}</Text>
                <View style={[styles.drugStatusBadge, drug.status === 'completed' ? styles.statusCompleted : styles.statusOther]}>
                  <Text style={[styles.drugStatusText, drug.status === 'completed' ? styles.statusCompletedText : styles.statusOtherText]}>
                    {drug.status}
                  </Text>
                </View>
              </View>
              <View style={styles.drugDetails}>
                <Text style={styles.drugDetail}>
                  Dose: {drug.actualDose ?? drug.plannedDose} {drug.unit}
                  {drug.actualDose && drug.actualDose !== drug.plannedDose
                    ? ` (planned: ${drug.plannedDose})`
                    : ''}
                </Text>
                <Text style={styles.drugDetail}>Route: {drug.route}</Text>
                {(drug.actualDurationMins || drug.plannedDurationMins) && (
                  <Text style={styles.drugDetail}>
                    Duration: {drug.actualDurationMins || drug.plannedDurationMins} min
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Vitals */}
        {summary.vitals && Object.keys(summary.vitals).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vitals at Treatment</Text>
            <View style={styles.vitalsGrid}>
              {Object.entries(summary.vitals).map(([key, val]) => (
                <View key={key} style={styles.vitalItem}>
                  <Text style={styles.vitalLabel}>{formatVitalLabel(key)}</Text>
                  <Text style={styles.vitalValue}>{formatVitalValue(key, val)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Reactions */}
        {summary.reactions && summary.reactions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reactions During Treatment</Text>
            <View style={styles.reactionsCard}>
              {summary.reactions.map((reaction, index) => (
                <View key={index} style={styles.reactionRow}>
                  <Ionicons name="alert-circle" size={16} color={Colors.warning} />
                  <Text style={styles.reactionText}>{reaction}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Dose Modifications */}
        {summary.doseModifications && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dose Modifications</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>{summary.doseModifications}</Text>
            </View>
          </View>
        )}

        {/* Take-Home Medications */}
        {summary.takeHomeMedications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Take-Home Medications</Text>
            {summary.takeHomeMedications.map((med, index) => (
              <View key={index} style={styles.medicationRow}>
                <Ionicons name="medkit-outline" size={18} color={Colors.primary} />
                <View style={styles.medicationInfo}>
                  <Text style={styles.medicationName}>{med.drugName}</Text>
                  <Text style={styles.medicationDetail}>
                    {med.dose} {med.unit} - {med.route}
                    {med.frequency ? ` - ${med.frequency}` : ''}
                  </Text>
                  {med.duration ? (
                    <Text style={styles.medicationDetail}>Duration: {med.duration}</Text>
                  ) : null}
                  {med.instructions ? (
                    <Text style={styles.medicationInstruction}>{med.instructions}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Next Appointment */}
        {summary.nextCycleDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Appointment</Text>
            <View style={styles.nextCycleCard}>
              <Ionicons name="calendar-outline" size={24} color={Colors.primary} />
              <View style={styles.nextCycleInfo}>
                <Text style={styles.nextCycleTitle}>
                  Cycle {summary.nextCycleNumber}
                </Text>
                <Text style={styles.nextCycleDate}>
                  {formatDate(summary.nextCycleDate)}
                </Text>
                <Text style={styles.nextCycleNote}>
                  Get pre-chemo blood work 2-3 days before
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Warning Signs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Warning Signs to Watch For</Text>
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={20} color="#DC2626" />
              <Text style={styles.warningHeaderText}>
                Contact hospital immediately if you experience:
              </Text>
            </View>
            {summary.warningSigns.map((sign, index) => (
              <View key={index} style={styles.warningRow}>
                <Text style={styles.warningBullet}>{'\u2022'}</Text>
                <Text style={styles.warningText}>{sign}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Follow-Up Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Follow-Up Instructions</Text>
          <View style={styles.instructionsCard}>
            {summary.followUpInstructions.split('\n').map((line, index) => (
              line.trim() ? (
                <View key={index} style={styles.instructionRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.instructionText}>{line}</Text>
                </View>
              ) : null
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.pdfButton} onPress={generatePDF} activeOpacity={0.7}>
            <Ionicons name="document-text" size={20} color={Colors.white} />
            <Text style={styles.shareButtonText}>Download PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={20} color={Colors.primary} />
            <Text style={styles.shareOutlineText}>Share as Text</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>

        {/* Generated timestamp */}
        <Text style={styles.generatedAt}>
          Generated {formatDate(summary.generatedAt)}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  errorTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  errorText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  retryText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },

  // Patient Header
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  patientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    color: Colors.textPrimary,
  },
  patientMeta: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },

  // Protocol Card
  protocolCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.small,
  },
  protocolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  protocolName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    flex: 1,
  },
  cycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cycleBadge: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  cycleBadgeText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
  },
  cycleDate: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },

  // Drug Rows
  drugRow: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.small,
  },
  drugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  drugName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
  },
  drugStatusBadge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  statusCompleted: {
    backgroundColor: '#D1FAE5',
  },
  statusOther: {
    backgroundColor: '#FEF3C7',
  },
  drugStatusText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.xxs,
    textTransform: 'capitalize',
  },
  statusCompletedText: {
    color: '#059669',
  },
  statusOtherText: {
    color: '#D97706',
  },
  drugDetails: {
    gap: 2,
  },
  drugDetail: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },

  // Vitals Grid
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  vitalItem: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minWidth: '47%',
    flex: 1,
    ...Shadows.small,
  },
  vitalLabel: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xxs,
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  vitalValue: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },

  // Reactions
  reactionsCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  reactionText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: '#92400E',
    flex: 1,
  },

  // Info Card
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.small,
  },
  infoText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 20,
  },

  // Medication
  medicationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.small,
  },
  medicationInfo: {
    flex: 1,
  },
  medicationName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  medicationDetail: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  medicationInstruction: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Next Cycle
  nextCycleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  nextCycleInfo: {
    flex: 1,
  },
  nextCycleTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
  },
  nextCycleDate: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  nextCycleNote: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },

  // Warning Card
  warningCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  warningHeaderText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    color: '#991B1B',
    flex: 1,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  warningBullet: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.sm,
    color: '#DC2626',
    lineHeight: 20,
  },
  warningText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: '#7F1D1D',
    flex: 1,
    lineHeight: 20,
  },

  // Instructions
  instructionsCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.small,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  instructionText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },

  // Actions
  actionsSection: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pdfButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  shareButtonText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
  },
  shareOutlineText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.primary,
  },
  doneButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    backgroundColor: Colors.background,
  },
  doneButtonText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.textPrimary,
  },

  // Footer
  generatedAt: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xxs,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
