import 'package:flutter/material.dart';

class ProcessTracker extends StatelessWidget {
  final String status;

  const ProcessTracker({super.key, required this.status});

  int get _currentStep {
    switch (status) {
      case 'rejected':
      case 'visa_issue':
        return 9;
      case 'visa_documents':
        return 8;
      case 'university_response':
        return 7;
      case 'tuition_payment':
        return 6;
      case 'waiting_invoice':
        return 5;
      case 'interview':
        return 4;
      case 'offline_application':
        return 3;
      case 'online_application':
        return 2;
      case 'documents_collection':
        return 1;
      case 'pending':
      case 'pending_approval':
        return 0; // Not actively processing yet
      default:
        return 0; // Default to initial setup or invalid state
    }
  }

  @override
  Widget build(BuildContext context) {
    const steps = [
      'Document preparation',
      'Online application',
      'Offline application',
      'Interview',
      'Waiting for invoice',
      'Tuition fee payment',
      'Waiting for admission letter',
      'Preparing for visa application',
      'Waiting for visa issue',
    ];

    final isStatusRejected = status == 'rejected';
    final activeIndex = _currentStep - 1;

    return ListView.builder(
      physics:
          const NeverScrollableScrollPhysics(), // Since it lives inside a tab view, it's preferable to be sized dynamically or let parent scroll
      shrinkWrap: true,
      itemCount: steps.length,
      itemBuilder: (context, index) {
        final isActive = index <= activeIndex;
        final isLast = index == steps.length - 1;
        final isRejectedNode = isStatusRejected && index == activeIndex;
        final nodeColor = isActive
            ? (isRejectedNode
                  ? Colors.redAccent
                  : Theme.of(context).colorScheme.primary)
            : Colors.grey.withValues(alpha: 0.3);

        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Left side timeline indicator
              Column(
                children: [
                  Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: nodeColor,
                      border: Border.all(
                        color: isActive ? Colors.transparent : Colors.white12,
                        width: 2,
                      ),
                    ),
                    child: isActive
                        ? Icon(
                            isRejectedNode ? Icons.close : Icons.check,
                            size: 14,
                            color: Colors.white,
                          )
                        : null,
                  ),
                  if (!isLast)
                    Expanded(
                      child: Container(
                        width: 2,
                        color: (index < activeIndex)
                            ? Theme.of(context).colorScheme.primary
                            : Colors.grey.withValues(alpha: 0.2),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 16),
              // Right side label text
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 24.0, top: 2),
                  child: Text(
                    steps[index],
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: isActive
                          ? FontWeight.bold
                          : FontWeight.normal,
                      color: isActive ? Colors.white : Colors.white54,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
