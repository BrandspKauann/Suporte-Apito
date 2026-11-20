<template>
	<BaseButton
		class="menu-bottom-link"
		:to="{name: 'about'}"
	>
		Apito de Mestre
	</BaseButton>
</template>

<script setup lang="ts">
import BaseButton from '@/components/base/BaseButton.vue'

defineProps<{
	utmMedium: string;
}>()

</script>

<style lang="scss">
.menu-bottom-link {
	color: var(--grey-300);
	text-align: center;
	display: block;
	padding-block-start: 1rem;
	padding-block-end: 1rem;
	font-size: .8rem;
}
</style>
