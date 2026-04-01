/**
 * Activity Enhancer - Converts simple activities to detailed templates
 */

import { DetailedActivity, DevelopmentalObjective, Material, InstructionStep, AgeAdaptation, DifferentiationStrategy, ObservationPrompt, WeekPlan } from 'shared';

export function enhanceActivity(
  activity: WeekPlan['activities'][0],
  week: WeekPlan,
  activityIndex: number
): DetailedActivity {
  const activityTimes = {
    Monday: "9:00 AM",
    Tuesday: "9:00 AM",
    Wednesday: "9:00 AM",
    Thursday: "9:00 AM",
    Friday: "9:00 AM",
  };

  // Generate domain-specific objectives
  const objectives = generateObjectives(activity.domain, week.theme);

  // Enhance materials with more detail
  const enhancedMaterials = activity.materials.map((item, index) => ({
    item,
    quantity: index === 0 ? '1 per child' : undefined,
    prepRequired: item.toLowerCase().includes('paint') || item.toLowerCase().includes('prepare'),
    substitute: getSuggestedSubstitute(item),
  }));

  // Generate step-by-step instructions
  const instructions = generateInstructions(activity, week.theme);

  // Enhanced age adaptations
  const adaptations: AgeAdaptation[] = activity.adaptations.map((adapt) => {
    const ageGroup = adapt.age as AgeAdaptation['ageGroup'];
    return {
      ageGroup,
      label: getAgeLabel(ageGroup),
      icon: getAgeIcon(ageGroup),
      duration: getDurationForAge(ageGroup),
      description: adapt.content,
      modifications: generateModifications(ageGroup, activity.domain),
    };
  });

  // Differentiation strategies
  const differentiation = generateDifferentiation(activity.domain);

  // Observation prompts
  const observationPrompts = generateObservationPrompts(activity.domain);

  // Reflection prompts
  const reflectionPrompts = [
    "What worked well during this activity?",
    "What would you adjust next time?",
    "Which children were most engaged? Why?",
    "Were there any unexpected challenges?",
  ];

  return {
    id: `activity-${week.id}-${activityIndex}`,
    day: activity.day,
    title: activity.title,
    timeBlock: activityTimes[activity.day as keyof typeof activityTimes],
    duration: getDurationForActivity(activity.domain),
    domains: [activity.domain, ...getSecondaryDomains(activity.domain)],
    themeConnection: `Children explore ${activity.domain.toLowerCase()} skills through ${week.theme.toLowerCase()}-themed experiences, strengthening ${getDomainBenefit(activity.domain)}.`,
    objectives,
    materials: enhancedMaterials,
    printMaterials: getPrintMaterials(activity.domain),
    instructions,
    adaptations,
    differentiation,
    observationPrompts,
    reflectionPrompts,
    createdDate: new Date().toISOString(),
  };
}

function generateObjectives(domain: string, theme: string): DevelopmentalObjective[] {
  const objectivesMap: Record<string, DevelopmentalObjective[]> = {
    'Sensory': [
      {
        domain: 'Sensory Processing',
        goals: [
          'Explore 3+ different textures safely',
          'Engage with materials for 5-10 minutes',
          'Use multiple senses (touch, sight, sound)',
        ],
      },
      {
        domain: 'Language',
        goals: [
          'Expose children to 3-5 new vocabulary words',
          'Encourage descriptive language use',
        ],
      },
    ],
    'Gross Motor': [
      {
        domain: 'Gross Motor',
        goals: [
          'Strengthen balance and coordination',
          'Practice age-appropriate movement patterns',
          'Develop spatial awareness',
        ],
      },
      {
        domain: 'Social-Emotional',
        goals: [
          'Participate in group movement activities',
          'Follow simple directions',
        ],
      },
    ],
    'Fine Motor': [
      {
        domain: 'Fine Motor',
        goals: [
          'Strengthen pincer grasp and hand control',
          'Develop hand-eye coordination',
          'Practice tool manipulation (brushes, stamps)',
        ],
      },
      {
        domain: 'Cognitive',
        goals: [
          'Explore cause and effect',
          'Make choices between materials',
        ],
      },
    ],
    'Language': [
      {
        domain: 'Language',
        goals: [
          'Introduce 5-7 new theme-related vocabulary words',
          'Encourage verbal responses and sound imitation',
          'Practice listening skills',
        ],
      },
      {
        domain: 'Social-Emotional',
        goals: [
          'Engage in shared attention during stories',
          'Express preferences verbally or non-verbally',
        ],
      },
    ],
    'Cognitive': [
      {
        domain: 'Cognitive',
        goals: [
          'Practice problem-solving through construction',
          'Explore spatial relationships',
          'Develop planning and sequencing skills',
        ],
      },
      {
        domain: 'Fine Motor',
        goals: [
          'Strengthen hand muscles through manipulation',
          'Practice stacking and balancing',
        ],
      },
    ],
  };

  return objectivesMap[domain] || objectivesMap['Sensory'];
}

function generateInstructions(activity: WeekPlan['activities'][0], theme: string): InstructionStep[] {
  const baseInstructions: InstructionStep[] = [
    {
      step: 1,
      title: 'Set Up Environment',
      description: 'Prepare the activity space with all materials accessible. Ensure safety and cleanliness. Create a calm, inviting atmosphere.',
      duration: '3-5 min',
    },
    {
      step: 2,
      title: 'Introduce Activity',
      description: `Gather children and introduce the ${theme.toLowerCase()} theme. Show materials and explain what you'll be exploring together. Use simple, clear language.`,
      duration: '2-3 min',
    },
    {
      step: 3,
      title: 'Model Behavior',
      description: 'Demonstrate how to interact with materials safely and appropriately. Narrate your actions using descriptive language.',
      duration: '2-3 min',
    },
    {
      step: 4,
      title: 'Guided Participation',
      description: 'Invite children to explore. Provide hand-over-hand support as needed. Observe and narrate what children are doing. Ask open-ended questions.',
      duration: '10-15 min',
    },
    {
      step: 5,
      title: 'Closing Transition',
      description: 'Give a 2-minute warning. Help children clean up together. Transition to next activity with a song or routine.',
      duration: '3-5 min',
    },
  ];

  return baseInstructions;
}

function generateModifications(ageGroup: AgeAdaptation['ageGroup'], domain: string): string[] {
  const modificationsMap: Record<string, Record<string, string[]>> = {
    '0-12m': {
      'Sensory': ['Provide tummy time positioning', 'Use high-contrast materials', 'Supervise all exploration closely'],
      'Gross Motor': ['Support sitting position', 'Provide floor time', 'Assist with reaching and grasping'],
      'Fine Motor': ['Hand-over-hand exploration', 'Use edible/safe materials', 'Focus on grasping reflexes'],
      'Language': ['Use board books with textures', 'Exaggerate facial expressions', 'Repeat simple sounds'],
      'Cognitive': ['Simple cause-effect toys', 'One object at a time', 'Follow child\'s gaze'],
    },
    '12-24m': {
      'Sensory': ['Allow independent exploration', 'Provide dumping/filling containers', 'Expect mouthing behavior'],
      'Gross Motor': ['Provide stable surfaces', 'Practice walking and climbing', 'Use push/pull toys'],
      'Fine Motor': ['Large, easy-to-grasp tools', 'Simple one-step actions', 'Expect whole-hand grasp'],
      'Language': ['Use 1-2 word phrases', 'Interactive books with flaps', 'Name objects repeatedly'],
      'Cognitive': ['Simple sorting (2 types)', 'Nesting/stacking toys', 'Imitation games'],
    },
    '24-36m': {
      'Sensory': ['Encourage verbal descriptions', 'Multi-sensory combinations', 'Extended exploration time'],
      'Gross Motor': ['Complex movements (hopping, balancing)', 'Obstacle courses', 'Ball skills'],
      'Fine Motor': ['Pincer grasp activities', 'Multi-step tasks', 'Tool use (scissors, tongs)'],
      'Language': ['3-4 word sentences', 'Answer "who/what/where" questions', 'Story retelling'],
      'Cognitive': ['Sorting by 2+ attributes', 'Simple counting (1-5)', 'Sequencing activities'],
    },
  };

  return modificationsMap[ageGroup]?.[domain] || ['Adapt based on individual needs'];
}

function generateDifferentiation(domain: string): DifferentiationStrategy[] {
  return [
    {
      type: 'support',
      title: 'For Children Needing Extra Support',
      strategies: [
        'Provide hand-over-hand assistance',
        'Break activity into smaller steps',
        'Use visual cues and modeling',
        'Reduce sensory input if needed',
        'Allow extra processing time',
      ],
    },
    {
      type: 'advanced',
      title: 'For Advanced Toddlers',
      strategies: [
        'Add complexity with multi-step tasks',
        'Introduce problem-solving challenges',
        'Encourage peer teaching/helping',
        'Expand vocabulary with descriptive words',
        'Extend activity with open-ended questions',
      ],
    },
    {
      type: 'mixed-age',
      title: 'Mixed-Age Group Tips',
      strategies: [
        'Pair older children with younger buddies',
        'Provide multiple complexity levels of same activity',
        'Use flexible materials adaptable to all levels',
        'Create parallel play opportunities',
        'Celebrate individual achievements at all levels',
      ],
    },
  ];
}

function generateObservationPrompts(domain: string): ObservationPrompt[] {
  return [
    {
      category: 'Engagement',
      prompts: [
        'How long did the child engage with the activity?',
        'What materials did they gravitate toward?',
        'Did they initiate exploration or need encouragement?',
      ],
    },
    {
      category: 'Skills Demonstrated',
      prompts: [
        'What movements or actions did the child attempt?',
        'What language (verbal or non-verbal) did they use?',
        'Did they show problem-solving strategies?',
      ],
    },
    {
      category: 'Social Interaction',
      prompts: [
        'Did they engage with peers during the activity?',
        'How did they respond to adult support?',
        'Were there any turn-taking moments?',
      ],
    },
    {
      category: 'Next Steps',
      prompts: [
        'What interests emerged?',
        'What skills are ready for scaffolding?',
        'What adaptations would support this child better?',
      ],
    },
  ];
}

// Helper functions
function getAgeLabel(ageGroup: string): string {
  const labels = {
    '0-12m': '0–12 months',
    '12-24m': '12–24 months',
    '24-36m': '24–36 months',
  };
  return labels[ageGroup as keyof typeof labels] || ageGroup;
}

function getAgeIcon(ageGroup: string): string {
  const icons = {
    '0-12m': '👶',
    '12-24m': '👣',
    '24-36m': '🎒',
  };
  return icons[ageGroup as keyof typeof icons] || '👶';
}

function getDurationForAge(ageGroup: string): string {
  const durations = {
    '0-12m': '5-8 min',
    '12-24m': '10-15 min',
    '24-36m': '15-20 min',
  };
  return durations[ageGroup as keyof typeof durations] || '10-15 min';
}

function getDurationForActivity(domain: string): number {
  const durations: Record<string, number> = {
    'Sensory': 20,
    'Gross Motor': 25,
    'Fine Motor': 20,
    'Language': 15,
    'Cognitive': 20,
  };
  return durations[domain] || 20;
}

function getSecondaryDomains(primaryDomain: string): string[] {
  const secondaryMap: Record<string, string[]> = {
    'Sensory': ['Language', 'Cognitive'],
    'Gross Motor': ['Social-Emotional'],
    'Fine Motor': ['Cognitive'],
    'Language': ['Social-Emotional'],
    'Cognitive': ['Fine Motor'],
  };
  return secondaryMap[primaryDomain] || [];
}

function getDomainBenefit(domain: string): string {
  const benefits: Record<string, string> = {
    'Sensory': 'sensory processing and tactile exploration',
    'Gross Motor': 'balance, coordination, and body awareness',
    'Fine Motor': 'hand-eye coordination and fine motor control',
    'Language': 'vocabulary development and communication skills',
    'Cognitive': 'problem-solving and critical thinking',
  };
  return benefits[domain] || 'developmental growth';
}

function getSuggestedSubstitute(item: string): string | undefined {
  const substitutes: Record<string, string> = {
    'paint': 'yogurt or pudding (edible)',
    'stamps': 'sponges or found objects',
    'scarves': 'lightweight fabric scraps',
    'puppets': 'stuffed animals',
    'books': 'homemade picture cards',
  };

  const itemLower = item.toLowerCase();
  for (const [key, value] of Object.entries(substitutes)) {
    if (itemLower.includes(key)) {
      return value;
    }
  }
  return undefined;
}

function getPrintMaterials(domain: string): string[] {
  const printables: Record<string, string[]> = {
    'Language': ['Vocabulary Picture Cards', 'Story Sequence Cards'],
    'Cognitive': ['Matching Game Cards', 'Sorting Mat'],
    'Fine Motor': ['Tracing Templates', 'Cutting Practice Sheets'],
  };
  return printables[domain] || [];
}