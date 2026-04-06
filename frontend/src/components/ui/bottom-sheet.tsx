"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-2xl bg-card border-t border-border",
              className
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {title && (
              <div className="px-4 pb-3 border-b border-border">
                <h3 className="text-base font-semibold">{title}</h3>
              </div>
            )}

            <div className="overflow-y-auto px-4 py-4 overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
