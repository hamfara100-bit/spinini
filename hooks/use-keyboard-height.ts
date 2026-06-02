import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Returns the current on-screen keyboard height (0 when hidden).
 *
 * Expo SDK 54 enables Android edge-to-edge by default, which makes the system
 * ignore `windowSoftInputMode=adjustResize` — so KeyboardAvoidingView no longer
 * reliably lifts bottom-anchored inputs (like the chat send bar) above the
 * keyboard. Reading the keyboard's real height from the Keyboard events and
 * padding the view by it works regardless.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvt, e => setHeight(e.endCoordinates?.height ?? 0));
    const onHide = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => { onShow.remove(); onHide.remove(); };
  }, []);

  return height;
}
