import React, { useCallback, useEffect, useState, useRef, useImperativeHandle, forwardRef } from "react";
import "./Modal.css";

const Modal = ({ isOpen, onClose, children }) => {
    const modalRef = useRef();

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) {
                if (typeof onClose === "function") {
                    onClose();
                }
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleOutsideClick);
        } else {
            document.removeEventListener("mousedown", handleOutsideClick);
        }

        return () =>
            document.removeEventListener("mousedown", handleOutsideClick);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" ref={modalRef}>
                {onClose ? (
                    <button className="modal-close" onClick={onClose}>
                        ×
                    </button>
                ) : null}
                {children}
            </div>
        </div>
    );
};

export default Modal;


export const QuickModal = forwardRef(({ children, cancel_message, confirm_message, onConfirm, onCancel, onClose }, ref) => {
    const [isOpen, setIsOpen] = useState(false);

    const onCancelFunction = useCallback(() => {
        setIsOpen(false);
        if (onCancel) onCancel();
    }, [onCancel]);

    const onCloseFunction = useCallback(() => {
        setIsOpen(false);
        if (onClose) onClose();
    }, [onClose]);

    const onConfirmFunction = useCallback(() => {
        setIsOpen(false);
        if (onConfirm) onConfirm();
    }, [onConfirm]);

    // 🔓 Expose open() to parent
    useImperativeHandle(ref, () => ({
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
    }));

    return (
        <Modal isOpen={isOpen} onClose={onCloseFunction}>
            {children}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                <button onClick={onCancelFunction} className="btn secondary">
                    {cancel_message || "Cancel"}
                </button>
                <button onClick={onConfirmFunction} className="btn confirm">
                    {confirm_message || "Confirm"}
                </button>
            </div>
        </Modal>
    );
});
