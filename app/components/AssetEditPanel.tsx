import React, { useState, useCallback } from 'react';

interface AssetEditPanelProps {
  asset: {
    assetNumber: number;
    title?: string;
    metadata?: {
      title?: string;
      description?: string;
      desc?: string;
    };
    priceUSD?: number;
  };
  onSave: (data: { title: string; description: string; price: number }) => void;
  onCancel: () => void;
}

export default function AssetEditPanel({ asset, onSave, onCancel }: AssetEditPanelProps) {
  const [formData, setFormData] = useState({
    title: asset.title || asset.metadata?.title || '',
    description: asset.metadata?.description || asset.metadata?.desc || '',
    price: asset.priceUSD || 1
  });

  const handleFieldChange = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(formData);
  }, [formData, onSave]);

  return (
    <div 
      className="onboarding-panel bg-gray-800 bg-opacity-90 rounded-lg p-6 mt-8 max-w-xl mx-auto backdrop-blur-sm border border-gray-600" 
      style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 100%)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: 700,
          color: '#F9FAFB',
          margin: 0
        }}>
          Edit Asset #{asset.assetNumber}
        </h2>
        <button
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#9CA3AF',
            fontSize: '24px',
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1
          }}
        >
          ✕
        </button>
      </div>

      {/* Title Input */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: 500,
          color: '#D1D5DB',
          marginBottom: '8px'
        }}>
          Content Title
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => handleFieldChange('title', e.target.value.slice(0, 100))}
          maxLength={100}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: '#374151',
            color: '#F9FAFB',
            border: '1px solid #4B5563',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none'
          }}
          onFocus={(e) => e.target.style.borderColor = '#F59E0B'}
          onBlur={(e) => e.target.style.borderColor = '#4B5563'}
        />
        <div style={{
          textAlign: 'right',
          fontSize: '12px',
          color: '#9CA3AF',
          marginTop: '4px'
        }}>
          {formData.title.length}/100 characters
        </div>
      </div>

      {/* Description Textarea */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: 500,
          color: '#D1D5DB',
          marginBottom: '8px'
        }}>
          Description <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleFieldChange('description', e.target.value.slice(0, 500))}
          maxLength={500}
          rows={4}
          placeholder="Tell collectors about this piece..."
          style={{
            width: '100%',
            padding: '10px 12px',
            background: '#374151',
            color: '#F9FAFB',
            border: '1px solid #4B5563',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none',
            resize: 'none'
          }}
          onFocus={(e) => e.target.style.borderColor = '#F59E0B'}
          onBlur={(e) => e.target.style.borderColor = '#4B5563'}
        />
        <div style={{
          textAlign: 'right',
          fontSize: '12px',
          color: '#9CA3AF',
          marginTop: '4px'
        }}>
          {formData.description.length}/500 characters
        </div>
      </div>

      {/* Price Input */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{
          display: 'block',
          fontSize: '14px',
          fontWeight: 500,
          color: '#D1D5DB',
          marginBottom: '8px'
        }}>
          Download Price (USD)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#F9FAFB', fontSize: '20px', fontWeight: 600 }}>$</span>
          <input
            type="number"
            value={formData.price}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val >= 0 && val <= 10000) {
                handleFieldChange('price', val);
              }
            }}
            min="0"
            max="10000"
            step="0.01"
            style={{
              flex: 1,
              padding: '10px 12px',
              background: '#374151',
              color: '#F9FAFB',
              border: '1px solid #4B5563',
              borderRadius: '6px',
              fontSize: '16px',
              outline: 'none'
            }}
            onFocus={(e) => e.target.style.borderColor = '#F59E0B'}
            onBlur={(e) => e.target.style.borderColor = '#4B5563'}
          />
          <span style={{ color: '#9CA3AF', fontSize: '14px' }}>per download</span>
        </div>
        {formData.price === 0 && (
          <p style={{ color: '#10B981', fontSize: '13px', marginTop: '6px', margin: 0 }}>
            Free giveaway - no charge
          </p>
        )}
        <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '6px', margin: '6px 0 0 0' }}>
          Artist receives 100% of sale price. Set to $0 for free downloads.
        </p>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '12px',
        paddingTop: '8px'
      }}>
        <button
          onClick={handleSave}
          disabled={!formData.title.trim()}
          style={{
            flex: 1,
            padding: '12px 24px',
            background: formData.title.trim() ? '#10B981' : '#374151',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: formData.title.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (formData.title.trim()) e.currentTarget.style.background = '#059669';
          }}
          onMouseLeave={(e) => {
            if (formData.title.trim()) e.currentTarget.style.background = '#10B981';
          }}
        >
          💾 Save Changes
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '12px 24px',
            background: '#4B5563',
            color: '#F9FAFB',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#6B7280'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#4B5563'}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

