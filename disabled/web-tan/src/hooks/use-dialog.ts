/**
 * useDialog Hook
 * Reusable hook for managing dialog open/close state
 * Reduces boilerplate in components with dialogs
 */

import { useCallback, useState } from "react";

type UseDialogReturn = {
  /**
   * Current open state of the dialog
   */
  open: boolean;

  /**
   * Open the dialog
   */
  openDialog: () => void;

  /**
   * Close the dialog
   */
  closeDialog: () => void;

  /**
   * Toggle the dialog open/close state
   */
  toggleDialog: () => void;

  /**
   * Set the dialog state directly
   */
  setOpen: (open: boolean) => void;

  /**
   * Props to spread onto the Dialog component
   * Usage: <Dialog {...dialogProps}>
   */
  dialogProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
};

/**
 * Hook for managing dialog state
 *
 * @param defaultOpen - Initial open state (default: false)
 * @returns Object with state and control functions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { dialogProps, openDialog, closeDialog } = useDialog();
 *
 *   return (
 *     <>
 *       <Button onClick={openDialog}>Open Dialog</Button>
 *       <Dialog {...dialogProps}>
 *         <DialogContent>
 *           <DialogHeader>
 *             <DialogTitle>My Dialog</DialogTitle>
 *           </DialogHeader>
 *           <DialogFooter>
 *             <Button onClick={closeDialog}>Close</Button>
 *           </DialogFooter>
 *         </DialogContent>
 *       </Dialog>
 *     </>
 *   );
 * }
 * ```
 */
export function useDialog(defaultOpen = false): UseDialogReturn {
  const [open, setOpen] = useState(defaultOpen);

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
  }, []);

  const toggleDialog = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return {
    open,
    openDialog,
    closeDialog,
    toggleDialog,
    setOpen,
    dialogProps: {
      open,
      onOpenChange: setOpen,
    },
  };
}

/**
 * Hook for managing multiple dialogs
 *
 * @param dialogNames - Array of dialog names
 * @returns Object with state and control functions for each dialog
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const dialogs = useMultipleDialogs(['create', 'edit', 'delete']);
 *
 *   return (
 *     <>
 *       <Button onClick={dialogs.create.openDialog}>Create</Button>
 *       <Button onClick={dialogs.edit.openDialog}>Edit</Button>
 *       <Button onClick={dialogs.delete.openDialog}>Delete</Button>
 *
 *       <Dialog {...dialogs.create.dialogProps}>
 *         {/* Create dialog content *\/}
 *       </Dialog>
 *
 *       <Dialog {...dialogs.edit.dialogProps}>
 *         {/* Edit dialog content *\/}
 *       </Dialog>
 *
 *       <Dialog {...dialogs.delete.dialogProps}>
 *         {/* Delete dialog content *\/}
 *       </Dialog>
 *     </>
 *   );
 * }
 * ```
 */
export function useMultipleDialogs<T extends string>(
  dialogNames: readonly T[]
): Record<T, UseDialogReturn> {
  const dialogs = {} as Record<T, UseDialogReturn>;

  for (const name of dialogNames) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    dialogs[name] = useDialog();
  }

  return dialogs;
}
