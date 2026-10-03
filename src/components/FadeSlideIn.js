// src/components/FadeSlideIn.js
//
// Generic "this just appeared" animation: fades in while sliding up a few
// pixels. Used by the navigator (src/app/navigation/AppNavigator.js) to
// animate screen switches (each screen mounts when it gains focus) and
// available to any screen/section that wants the same entrance motion
// without hand-rolling its own Animated.Value pair.
//
// Deliberately a MOUNT animation, not a continuous transition: the calling
// code is expected to force a remount when it wants the effect to replay
// (e.g. by mounting it on focus, or with a key), rather than this component trying
// to detect prop changes itself. That keeps the animation timing fully
// predictable and keeps this component free of edge cases around
// re-triggering mid-animation.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export function FadeSlideIn({
  children,
  style,
  duration = 260,
  distance = 14,
  delay = 0,
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
    // Intentionally empty deps — this is a mount-only animation; replaying
    // it is the caller's job via remounting (see file header comment).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
