import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, FieldError, Section } from '@/components/ui';
import { api } from '@/lib/api';
import { buildReviewPayload, ratingLabel, REVIEW_COMMENT_MAX, reviewState } from '@/lib/tripReview';
import { formatDateTime } from '@/lib/trips';
import { colors, radius, space, TOUCH, type, fonts } from '@/constants/theme';

/**
 * The shipper's review of the carrier on a delivered or completed trip. Only a COMPLETED trip can be reviewed (the
 * shipper accepted the delivery); the server enforces that and the one-review rule. Stars and the comment are
 * sent as typed; the carrier comes from the trip on the server.
 */
export default function TripReviewSection({ tripId, status }) {
  const [review, setReview] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const eligible = status === 'COMPLETED' || status === 'DELIVERED';

  /** Loads the trip's review (zero or one). A failed load is shown as an error, not as "no review". */
  const load = useCallback(async () => {
    try {
      const list = await api.get(`/api/v1/trips/${tripId}/reviews`);
      setReview(Array.isArray(list) ? list[0] ?? null : null);
      setLoadError('');
    } catch (failure) {
      setLoadError(failure.message || 'Chưa tải được đánh giá của chuyến.');
    } finally {
      setLoaded(true);
    }
  }, [tripId]);

  useEffect(() => {
    if (eligible) void load();
  }, [eligible, load]);

  if (!eligible) return null;

  const state = reviewState({ status }, review);

  /** Sends the review once. A 409 means it already exists, so the view reloads instead of showing an error. */
  const submit = async () => {
    if (busy) return;
    const built = buildReviewPayload({ rating, comment });
    if (!built.ok) {
      setError(built.error);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await api.post(`/api/v1/trips/${tripId}/reviews`, built.payload);
      setReview(saved);
    } catch (failure) {
      if (failure.status === 409) {
        await load();
      } else {
        setError(failure.message || 'Chưa gửi được đánh giá. Vui lòng thử lại.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Đánh giá nhà xe">
      {!loaded ? <Text style={type.secondary}>Đang tải đánh giá...</Text> : null}
      {loadError ? <FieldError message={loadError} /> : null}

      {loaded && review ? (
        <View style={styles.block}>
          <Text style={[type.body, styles.stars]} accessibilityLabel={`Đã đánh giá ${review.rating} sao`}>
            {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)} · {ratingLabel(review.rating)}
          </Text>
          <Text style={type.body}>{review.comment || 'Không có nhận xét.'}</Text>
          <Text style={type.caption}>Đã gửi {formatDateTime(review.createdAt)}</Text>
        </View>
      ) : null}

      {loaded && !review && state.canReview ? (
        <View style={styles.block}>
          <Text style={type.secondary}>{state.message}</Text>
          <View style={styles.starRow} accessibilityRole="radiogroup" accessibilityLabel="Số sao">
            {[1, 2, 3, 4, 5].map((stars) => (
              <Pressable
                key={stars}
                accessibilityRole="radio"
                accessibilityLabel={`${stars} sao`}
                accessibilityState={{ checked: rating === stars }}
                onPress={() => { setRating(stars); setError(''); }}
                disabled={busy}
                style={[styles.star, rating === stars && styles.starActive]}
              >
                <Text style={[styles.starText, rating === stars && styles.starTextActive]}>{stars}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={type.caption}>{rating ? ratingLabel(rating) : 'Chọn số sao (bắt buộc)'}</Text>
          <TextInput
            accessibilityLabel="Nhận xét"
            value={comment}
            onChangeText={(value) => { setComment(value.slice(0, REVIEW_COMMENT_MAX)); setError(''); }}
            placeholder="Nhận xét (không bắt buộc). Không ghi email hoặc số điện thoại."
            placeholderTextColor={colors.inkSubtle}
            multiline
            maxLength={REVIEW_COMMENT_MAX}
            editable={!busy}
            style={styles.input}
          />
          <FieldError message={error} />
          <Button label={busy ? 'Đang gửi...' : 'Gửi đánh giá'} onPress={submit} loading={busy} disabled={busy} />
        </View>
      ) : null}

      {loaded && !review && !state.canReview && state.message ? <Text style={type.secondary}>{state.message}</Text> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  stars: { fontFamily: fonts.semibold, color: colors.warning },
  starRow: { flexDirection: 'row', gap: space.sm },
  star: {
    minWidth: TOUCH, minHeight: TOUCH, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
  starActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  starText: { fontSize: 16, fontFamily: fonts.semibold, color: colors.ink },
  starTextActive: { color: colors.surface },
  input: {
    minHeight: TOUCH * 2, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md,
    padding: space.md, fontSize: 15, color: colors.ink, backgroundColor: colors.surface, textAlignVertical: 'top',
  },
});
