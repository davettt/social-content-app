import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject, useUpdateProject } from '../../hooks/useProjects';
import { useAnalyzeWebsite } from '../../hooks/useAI';
import { Button } from '../common/Button';
import { Input, Textarea } from '../common/Input';
import { PageLoader } from '../common/LoadingSpinner';
import type { BusinessInfo, BrandKit, ContactInfo } from '../../types';

export function ProjectSettings() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const updateProject = useUpdateProject();
  const analyzeWebsite = useAnalyzeWebsite();

  const [activeTab, setActiveTab] = useState<'business' | 'brand' | 'contact'>('business');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [additionalPages, setAdditionalPages] = useState<string[]>([]);
  const [showWebsiteAnalyzer, setShowWebsiteAnalyzer] = useState(false);
  const [businessInfo, setBusinessInfo] = useState<Partial<BusinessInfo> | null>(null);
  const [brandKit, setBrandKit] = useState<Partial<BrandKit> | null>(null);
  const [contactInfo, setContactInfo] = useState<Partial<ContactInfo> | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Initialize state from project when it loads
  if (project && !businessInfo) {
    setBusinessInfo(project.businessInfo);
    setBrandKit(project.brandKit);
    setContactInfo(project.contactInfo);
    setWebsiteUrl(project.businessInfo.websiteUrl || '');
  }

  if (isLoading) return <PageLoader />;

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-600">Project not found</p>
      </div>
    );
  }

  const handleAnalyzeWebsite = async () => {
    if (!websiteUrl || !projectId) return;

    const result = await analyzeWebsite.mutateAsync({
      url: websiteUrl,
      pages: additionalPages.filter(Boolean),
    });

    if (result.success && result.analysis) {
      const { analysis } = result;

      const newBusinessInfo = {
        ...businessInfo,
        websiteUrl,
        description: analysis.description,
        industry: analysis.industry,
        services: analysis.services,
        targetAudience: analysis.targetAudience,
        tone: analysis.tone as BusinessInfo['tone'],
      };

      const newBrandKit = {
        ...brandKit,
        primaryColor: analysis.suggestedColors?.primary || brandKit?.primaryColor || '#3b82f6',
        secondaryColor: analysis.suggestedColors?.secondary || brandKit?.secondaryColor || '#f59e0b',
        accentColor: analysis.suggestedColors?.accent || brandKit?.accentColor || '#10b981',
        fonts: {
          heading: analysis.suggestedFonts?.heading || brandKit?.fonts?.heading || 'Inter',
          body: analysis.suggestedFonts?.body || brandKit?.fonts?.body || 'Inter',
        },
        colorPalette: analysis.extractedColorPalette || brandKit?.colorPalette || [],
      };

      const newContactInfo = {
        ...contactInfo,
        email: analysis.contactInfo?.email || contactInfo?.email,
        phone: analysis.contactInfo?.phone || contactInfo?.phone,
        address: analysis.contactInfo?.address || contactInfo?.address,
        socialHandles: {
          ...contactInfo?.socialHandles,
          instagram: analysis.socialHandles?.instagram || contactInfo?.socialHandles?.instagram,
          twitter: analysis.socialHandles?.twitter || contactInfo?.socialHandles?.twitter,
          linkedin: analysis.socialHandles?.linkedin || contactInfo?.socialHandles?.linkedin,
        },
      };

      // Update local state
      setBusinessInfo(newBusinessInfo);
      setBrandKit(newBrandKit);
      setContactInfo(newContactInfo);
      setShowWebsiteAnalyzer(false);

      // Auto-save the analysis results
      setSaveStatus('saving');
      await updateProject.mutateAsync({
        id: projectId,
        data: {
          businessInfo: newBusinessInfo as BusinessInfo,
          brandKit: newBrandKit as BrandKit,
          contactInfo: newContactInfo as ContactInfo,
        },
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleSave = async () => {
    if (!projectId) return;

    setSaveStatus('saving');
    await updateProject.mutateAsync({
      id: projectId,
      data: {
        businessInfo: businessInfo as BusinessInfo,
        brandKit: brandKit as BrandKit,
        contactInfo: contactInfo as ContactInfo,
      },
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Settings</h1>
          <p className="text-gray-600 mt-1">{project.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate(`/projects/${projectId}`)}>
            Back to Dashboard
          </Button>
          <Button
            onClick={handleSave}
            isLoading={saveStatus === 'saving'}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saved' ? '✓ Saved' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Website Analyzer Section */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Website Analysis</h2>
            <p className="text-sm text-gray-500 mt-1">
              {businessInfo?.websiteUrl
                ? `Last analyzed: ${businessInfo.websiteUrl}`
                : 'No website analyzed yet'}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowWebsiteAnalyzer(!showWebsiteAnalyzer)}
          >
            {showWebsiteAnalyzer ? 'Cancel' : 'Analyze Website'}
          </Button>
        </div>

        {showWebsiteAnalyzer && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website URL
              </label>
              <Input
                placeholder="https://yourwebsite.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Pages to Analyze (optional)
              </label>
              {additionalPages.map((page, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    placeholder="/about, /services, /contact"
                    value={page}
                    onChange={(e) => {
                      const newPages = [...additionalPages];
                      newPages[index] = e.target.value;
                      setAdditionalPages(newPages);
                    }}
                  />
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setAdditionalPages(additionalPages.filter((_, i) => i !== index))
                    }
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAdditionalPages([...additionalPages, ''])}
              >
                + Add Page
              </Button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">
                AI will extract brand info, colors, and business details from your website
              </p>
              <Button
                onClick={handleAnalyzeWebsite}
                disabled={!websiteUrl}
                isLoading={analyzeWebsite.isPending}
              >
                Analyze Website
              </Button>
            </div>

            {analyzeWebsite.isError && (
              <p className="text-sm text-red-600">
                Failed to analyze website. Please check the URL and try again.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          {[
            { id: 'business', label: 'Business Info' },
            { id: 'brand', label: 'Brand Kit' },
            { id: 'contact', label: 'Contact Info' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Business Info Tab */}
      {activeTab === 'business' && businessInfo && (
        <div className="card p-6 space-y-6">
          <Textarea
            label="Business Description"
            placeholder="Describe what your business does..."
            rows={4}
            value={businessInfo.description || ''}
            onChange={(e) =>
              setBusinessInfo({ ...businessInfo, description: e.target.value })
            }
          />

          <Input
            label="Industry"
            placeholder="e.g., Technology, Food & Beverage"
            value={businessInfo.industry || ''}
            onChange={(e) =>
              setBusinessInfo({ ...businessInfo, industry: e.target.value })
            }
          />

          <Textarea
            label="Target Audience"
            placeholder="e.g., Small business owners aged 25-45 who are looking to grow their online presence..."
            rows={3}
            value={businessInfo.targetAudience || ''}
            onChange={(e) =>
              setBusinessInfo({ ...businessInfo, targetAudience: e.target.value })
            }
          />

          <Textarea
            label="Services"
            placeholder="Enter each service on a new line, e.g.:&#10;Web Design&#10;Marketing&#10;Consulting"
            rows={4}
            value={businessInfo.services?.join('\n') || ''}
            onChange={(e) =>
              setBusinessInfo({
                ...businessInfo,
                services: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
              })
            }
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Brand Tone
            </label>
            <div className="flex flex-wrap gap-2">
              {(['professional', 'casual', 'fun', 'inspirational', 'educational'] as const).map(
                (tone) => (
                  <button
                    key={tone}
                    onClick={() => setBusinessInfo({ ...businessInfo, tone })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      businessInfo.tone === tone
                        ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                        : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    {tone}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Brand Kit Tab */}
      {activeTab === 'brand' && brandKit && (
        <div className="card p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Brand Colors
            </label>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="text-xs text-gray-500 block mb-2">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={brandKit.primaryColor || '#3b82f6'}
                    onChange={(e) =>
                      setBrandKit({ ...brandKit, primaryColor: e.target.value })
                    }
                    className="w-12 h-12 rounded-lg cursor-pointer"
                  />
                  <Input
                    value={brandKit.primaryColor || ''}
                    onChange={(e) =>
                      setBrandKit({ ...brandKit, primaryColor: e.target.value })
                    }
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-2">Secondary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={brandKit.secondaryColor || '#f59e0b'}
                    onChange={(e) =>
                      setBrandKit({ ...brandKit, secondaryColor: e.target.value })
                    }
                    className="w-12 h-12 rounded-lg cursor-pointer"
                  />
                  <Input
                    value={brandKit.secondaryColor || ''}
                    onChange={(e) =>
                      setBrandKit({ ...brandKit, secondaryColor: e.target.value })
                    }
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-2">Accent Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={brandKit.accentColor || '#10b981'}
                    onChange={(e) =>
                      setBrandKit({ ...brandKit, accentColor: e.target.value })
                    }
                    className="w-12 h-12 rounded-lg cursor-pointer"
                  />
                  <Input
                    value={brandKit.accentColor || ''}
                    onChange={(e) =>
                      setBrandKit({ ...brandKit, accentColor: e.target.value })
                    }
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Heading Font"
              placeholder="e.g., Inter, Roboto"
              value={brandKit.fonts?.heading || ''}
              onChange={(e) =>
                setBrandKit({
                  ...brandKit,
                  fonts: { ...brandKit.fonts, heading: e.target.value, body: brandKit.fonts?.body || '' },
                })
              }
            />
            <Input
              label="Body Font"
              placeholder="e.g., Inter, Open Sans"
              value={brandKit.fonts?.body || ''}
              onChange={(e) =>
                setBrandKit({
                  ...brandKit,
                  fonts: { ...brandKit.fonts, body: e.target.value, heading: brandKit.fonts?.heading || '' },
                })
              }
            />
          </div>

          {/* Extracted Color Palette */}
          {brandKit.colorPalette && brandKit.colorPalette.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Extracted Color Palette
                <span className="text-xs text-gray-400 ml-2">(click to set as primary/secondary/accent)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {brandKit.colorPalette.map((color, index) => (
                  <div key={index} className="relative group">
                    <div
                      className="w-10 h-10 rounded-lg border-2 border-gray-200 cursor-pointer hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 hidden group-hover:flex gap-1 bg-white shadow-lg rounded-lg p-1 z-10">
                      <button
                        onClick={() => setBrandKit({ ...brandKit, primaryColor: color })}
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                        title="Set as Primary"
                      >
                        P
                      </button>
                      <button
                        onClick={() => setBrandKit({ ...brandKit, secondaryColor: color })}
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                        title="Set as Secondary"
                      >
                        S
                      </button>
                      <button
                        onClick={() => setBrandKit({ ...brandKit, accentColor: color })}
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                        title="Set as Accent"
                      >
                        A
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Hover over a color and click P (Primary), S (Secondary), or A (Accent) to assign it
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color Preview
            </label>
            <div className="flex gap-2">
              <div
                className="w-20 h-20 rounded-xl flex items-center justify-center text-white font-bold text-xs text-center"
                style={{ backgroundColor: brandKit.primaryColor }}
              >
                Primary
              </div>
              <div
                className="w-20 h-20 rounded-xl flex items-center justify-center text-white font-bold text-xs text-center"
                style={{ backgroundColor: brandKit.secondaryColor }}
              >
                Secondary
              </div>
              <div
                className="w-20 h-20 rounded-xl flex items-center justify-center text-white font-bold text-xs text-center"
                style={{ backgroundColor: brandKit.accentColor }}
              >
                Accent
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Info Tab */}
      {activeTab === 'contact' && contactInfo && (
        <div className="card p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="contact@example.com"
              value={contactInfo.email || ''}
              onChange={(e) =>
                setContactInfo({ ...contactInfo, email: e.target.value })
              }
            />
            <Input
              label="Phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={contactInfo.phone || ''}
              onChange={(e) =>
                setContactInfo({ ...contactInfo, phone: e.target.value })
              }
            />
          </div>

          <Input
            label="Address"
            placeholder="123 Main St, City, State"
            value={contactInfo.address || ''}
            onChange={(e) =>
              setContactInfo({ ...contactInfo, address: e.target.value })
            }
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Social Media Handles
            </label>
            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Instagram"
                placeholder="@yourbrand"
                value={contactInfo.socialHandles?.instagram || ''}
                onChange={(e) =>
                  setContactInfo({
                    ...contactInfo,
                    socialHandles: {
                      ...contactInfo.socialHandles,
                      instagram: e.target.value,
                    },
                  })
                }
              />
              <Input
                label="Twitter / X"
                placeholder="@yourbrand"
                value={contactInfo.socialHandles?.twitter || ''}
                onChange={(e) =>
                  setContactInfo({
                    ...contactInfo,
                    socialHandles: {
                      ...contactInfo.socialHandles,
                      twitter: e.target.value,
                    },
                  })
                }
              />
              <Input
                label="LinkedIn"
                placeholder="company/yourbrand"
                value={contactInfo.socialHandles?.linkedin || ''}
                onChange={(e) =>
                  setContactInfo({
                    ...contactInfo,
                    socialHandles: {
                      ...contactInfo.socialHandles,
                      linkedin: e.target.value,
                    },
                  })
                }
              />
              <Input
                label="Threads"
                placeholder="@yourbrand"
                value={contactInfo.socialHandles?.threads || ''}
                onChange={(e) =>
                  setContactInfo({
                    ...contactInfo,
                    socialHandles: {
                      ...contactInfo.socialHandles,
                      threads: e.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
