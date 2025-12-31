import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateProject, useUpdateProject } from '../../hooks/useProjects';
import { useAnalyzeWebsite } from '../../hooks/useAI';
import { Button } from '../common/Button';
import { Input, Textarea } from '../common/Input';
import type { BusinessInfo, BrandKit } from '../../types';

type SetupStep = 'name' | 'method' | 'website' | 'questionnaire' | 'review';

export function ProjectSetup() {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const analyzeWebsite = useAnalyzeWebsite();

  const [step, setStep] = useState<SetupStep>('name');
  const [projectName, setProjectName] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [additionalPages, setAdditionalPages] = useState<string[]>([]);
  const [businessInfo, setBusinessInfo] = useState<Partial<BusinessInfo>>({
    description: '',
    services: [],
    tone: 'professional',
  });
  const [brandKit, setBrandKit] = useState<Partial<BrandKit>>({
    primaryColor: '#3b82f6',
    secondaryColor: '#f59e0b',
    accentColor: '#10b981',
  });

  const handleCreateProject = async () => {
    const result = await createProject.mutateAsync({ name: projectName });
    setProjectId(result.id);
    setStep('method');
  };

  const handleAnalyzeWebsite = async () => {
    const result = await analyzeWebsite.mutateAsync({
      url: websiteUrl,
      pages: additionalPages.filter(Boolean),
    });

    if (result.success && result.analysis) {
      const { analysis } = result;
      setBusinessInfo({
        websiteUrl,
        description: analysis.description,
        industry: analysis.industry,
        services: analysis.services,
        targetAudience: analysis.targetAudience,
        tone: analysis.tone as BusinessInfo['tone'],
      });
      setBrandKit({
        primaryColor: analysis.suggestedColors?.primary || '#3b82f6',
        secondaryColor: analysis.suggestedColors?.secondary || '#f59e0b',
        accentColor: analysis.suggestedColors?.accent || '#10b981',
        fonts: {
          heading: analysis.suggestedFonts?.heading || 'Inter',
          body: analysis.suggestedFonts?.body || 'Inter',
        },
      });
      setStep('review');
    }
  };

  const handleSaveProject = async () => {
    if (!projectId) return;

    await updateProject.mutateAsync({
      id: projectId,
      data: { businessInfo, brandKit },
    });

    navigate(`/projects/${projectId}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          {(['name', 'method', 'website', 'questionnaire', 'review'] as SetupStep[]).map(
            (s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${
                  i <= ['name', 'method', 'website', 'questionnaire', 'review'].indexOf(step)
                    ? 'bg-primary-500'
                    : 'bg-gray-200'
                }`}
              />
            )
          )}
        </div>
      </div>

      {step === 'name' && (
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create a New Project</h1>
          <p className="text-gray-600 mb-6">
            Start by giving your project a name. This could be your business name or
            brand.
          </p>

          <Input
            label="Project Name"
            placeholder="e.g., Acme Corp, My Travel Blog"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            autoFocus
          />

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleCreateProject}
              disabled={!projectName.trim()}
              isLoading={createProject.isPending}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'method' && (
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Set Up Your Brand</h1>
          <p className="text-gray-600 mb-6">
            How would you like to set up your brand profile?
          </p>

          <div className="grid gap-4">
            <button
              onClick={() => setStep('website')}
              className="p-6 text-left border-2 border-gray-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-primary-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Analyze My Website</h3>
                  <p className="text-sm text-gray-500">
                    AI will extract your brand info from your website
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setStep('questionnaire')}
              className="p-6 text-left border-2 border-gray-200 rounded-xl hover:border-primary-500 hover:bg-primary-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-primary-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Fill Out Questionnaire</h3>
                  <p className="text-sm text-gray-500">
                    Manually enter your business details
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {step === 'website' && (
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Analyze Your Website</h1>
          <p className="text-gray-600 mb-6">
            Enter your website URL and we'll extract your brand information.
          </p>

          <div className="space-y-4">
            <Input
              label="Website URL"
              type="url"
              placeholder="https://yourwebsite.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Pages to Analyze (optional)
              </label>
              {additionalPages.map((page, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    placeholder="/about, /services"
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
          </div>

          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep('method')}>
              Back
            </Button>
            <Button
              onClick={handleAnalyzeWebsite}
              disabled={!websiteUrl}
              isLoading={analyzeWebsite.isPending}
            >
              Analyze Website
            </Button>
          </div>
        </div>
      )}

      {step === 'questionnaire' && (
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tell Us About Your Business</h1>
          <p className="text-gray-600 mb-6">
            Fill in your business details to help us create better content.
          </p>

          <div className="space-y-4">
            <Textarea
              label="What does your business do?"
              placeholder="We help small businesses..."
              rows={3}
              value={businessInfo.description}
              onChange={(e) =>
                setBusinessInfo({ ...businessInfo, description: e.target.value })
              }
            />

            <Input
              label="Industry"
              placeholder="e.g., Technology, Food & Beverage, Travel"
              value={businessInfo.industry || ''}
              onChange={(e) =>
                setBusinessInfo({ ...businessInfo, industry: e.target.value })
              }
            />

            <Input
              label="Target Audience"
              placeholder="e.g., Small business owners aged 25-45"
              value={businessInfo.targetAudience || ''}
              onChange={(e) =>
                setBusinessInfo({ ...businessInfo, targetAudience: e.target.value })
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brand Colors
              </label>
              <div className="flex gap-4">
                <div>
                  <label className="text-xs text-gray-500">Primary</label>
                  <input
                    type="color"
                    value={brandKit.primaryColor}
                    onChange={(e) =>
                      setBrandKit({ ...brandKit, primaryColor: e.target.value })
                    }
                    className="block w-12 h-12 rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Secondary</label>
                  <input
                    type="color"
                    value={brandKit.secondaryColor}
                    onChange={(e) =>
                      setBrandKit({ ...brandKit, secondaryColor: e.target.value })
                    }
                    className="block w-12 h-12 rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Accent</label>
                  <input
                    type="color"
                    value={brandKit.accentColor}
                    onChange={(e) =>
                      setBrandKit({ ...brandKit, accentColor: e.target.value })
                    }
                    className="block w-12 h-12 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={() => setStep('method')}>
              Back
            </Button>
            <Button onClick={() => setStep('review')}>Continue</Button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Review Your Project</h1>
          <p className="text-gray-600 mb-6">
            Review the information below and make any changes before saving.
          </p>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Project Name</h3>
              <p className="text-lg font-semibold">{projectName}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
              <Textarea
                value={businessInfo.description}
                onChange={(e) =>
                  setBusinessInfo({ ...businessInfo, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Industry</h3>
                <Input
                  value={businessInfo.industry || ''}
                  onChange={(e) =>
                    setBusinessInfo({ ...businessInfo, industry: e.target.value })
                  }
                />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Tone</h3>
                <p className="capitalize">{businessInfo.tone}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Brand Colors</h3>
              <div className="flex gap-2">
                <div
                  className="w-10 h-10 rounded-lg"
                  style={{ backgroundColor: brandKit.primaryColor }}
                />
                <div
                  className="w-10 h-10 rounded-lg"
                  style={{ backgroundColor: brandKit.secondaryColor }}
                />
                <div
                  className="w-10 h-10 rounded-lg"
                  style={{ backgroundColor: brandKit.accentColor }}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <Button variant="secondary" onClick={() => setStep('questionnaire')}>
              Edit Details
            </Button>
            <Button onClick={handleSaveProject} isLoading={updateProject.isPending}>
              Save Project
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
