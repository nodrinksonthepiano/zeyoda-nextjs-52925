'use client'

import React from 'react';
import { WizardStep, useChatWizard, ChatMessage, MediaFile } from '../../contexts/ChatWizardContext';
import { FontSelector } from './FontSelector';
import { ColorPalette } from './ColorPalette';
import { MediaUpload } from './MediaUpload';
import { ConfirmationStep } from './ConfirmationStep';

interface WizardMessageProps {
  message: ChatMessage;
}

export function WizardMessage({ message }: WizardMessageProps) {
  const { state, updateData, addMessage, nextStep } = useChatWizard();

  const renderInteractiveElement = () => {
    if (!message.step) return null;

    switch (message.step) {
      case WizardStep.ASK_NAME:
      case WizardStep.ASK_ARTWORK_TITLE:
      case WizardStep.ASK_ARTWORK_YEAR:
      case WizardStep.ASK_TOKEN_SYMBOL:
        // These steps now use the unified input field at the bottom
        return null;

      case WizardStep.ASK_FONT:
        return (
          <FontSelector
            onFontSelect={(font) => {
              updateData({ fontFamily: font });
              addMessage({
                type: 'user',
                content: `Selected font: ${font}`
              });
              setTimeout(() => nextStep(), 500);
            }}
            selectedFont={state.data.fontFamily}
          />
        );

      case WizardStep.ASK_BRAND_COLOR:
        return (
          <ColorPalette
            colorType="primary"
            currentColor={state.data.primaryColor}
            onColorSelect={(color) => {
              updateData({ primaryColor: color });
              addMessage({
                type: 'user',
                content: `Selected primary color: ${color}`
              });
              setTimeout(() => nextStep(), 500);
            }}
          />
        );

      case WizardStep.ASK_ACCENT_COLOR:
        return (
          <ColorPalette
            colorType="accent"
            currentColor={state.data.accentColor}
            onColorSelect={(color) => {
              updateData({ accentColor: color });
              addMessage({
                type: 'user',
                content: `Selected accent color: ${color}`
              });
              setTimeout(() => nextStep(), 500);
            }}
          />
        );

      case WizardStep.ASK_MEDIA_UPLOAD:
        return (
          <MediaUpload
            onFilesUploaded={(files: MediaFile[]) => {
              updateData({ mediaFiles: files });
              addMessage({
                type: 'user',
                content: `Uploaded ${files.length} file(s): ${files.map((f: MediaFile) => f.title).join(', ')}`
              });
              setTimeout(() => nextStep(), 500);
            }}
            existingFiles={state.data.mediaFiles}
          />
        );

      case WizardStep.CONFIRM_CREATION:
        return (
          <ConfirmationStep
            wizardData={state.data}
            onConfirm={() => {
              addMessage({
                type: 'user',
                content: 'Yes, create my artist profile and mint tokens!'
              });
              setTimeout(() => nextStep(), 500);
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="wizard-message">
      {/* Bot message content */}
      <div className="bot-message-content">
        {message.content}
      </div>

      {/* Interactive element for current step */}
      {message.step === state.currentStep && renderInteractiveElement()}
    </div>
  );
} 